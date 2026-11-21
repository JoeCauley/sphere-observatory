"""Run the foreground frame comparison and independently record Windows' active display."""
import ctypes as ct
from ctypes import wintypes as wt
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time

if sys.platform != "win32":
    raise SystemExit("This display observer requires Windows.")
if len(sys.argv) != 2:
    raise SystemExit("Usage: python tools/measure-frame-cadence-windows.py output.json")

user = ct.windll.user32
user.SetProcessDpiAwarenessContext(ct.c_void_p(-4))
user.GetForegroundWindow.restype = wt.HWND
user.GetWindowThreadProcessId.argtypes = [wt.HWND, ct.POINTER(wt.DWORD)]
user.MonitorFromWindow.argtypes = [wt.HWND, wt.DWORD]
user.MonitorFromWindow.restype = wt.HMONITOR
user.GetMonitorInfoW.argtypes = [wt.HMONITOR, ct.c_void_p]
user.SetForegroundWindow.argtypes = user.BringWindowToTop.argtypes = [wt.HWND]
user.IsWindowVisible.argtypes = user.IsIconic.argtypes = [wt.HWND]
user.ShowWindow.argtypes = [wt.HWND, ct.c_int]

class Display(ct.Structure):
    _fields_ = [("size", wt.DWORD), ("name", wt.WCHAR * 32), ("description", wt.WCHAR * 128),
                ("flags", wt.DWORD), ("hardware", wt.WCHAR * 128), ("key", wt.WCHAR * 128)]

class MonitorInfo(ct.Structure):
    _fields_ = [("size", wt.DWORD), ("screen", wt.RECT), ("work", wt.RECT),
                ("flags", wt.DWORD), ("device", wt.WCHAR * 32)]

def devices(parent=None):
    index = 0
    while True:
        device = Display()
        device.size = ct.sizeof(device)
        if not user.EnumDisplayDevicesW(parent, index, ct.byref(device), 0):
            return
        if device.flags & 1:
            yield device
        index += 1

def displays():
    result = []
    for adapter in devices():
        # DEVMODEW has a fixed 220-byte base on Windows. Request the active mode.
        mode = ct.create_string_buffer(220)
        struct.pack_into("<H", mode, 68, len(mode))
        if not user.EnumDisplaySettingsW(adapter.name, -1, mode):
            raise OSError("Cannot read the active mode for " + adapter.name)
        width, height, _, hz = struct.unpack_from("<IIII", mode, 172)
        panels = [monitor.hardware.split("\\")[1] for monitor in devices(adapter.name)]
        result.append(dict(device=adapter.name, gpu=adapter.description, mode=[width, height], refreshHz=hz, panels=panels))
    return result

def pid_for(hwnd):
    pid = wt.DWORD()
    user.GetWindowThreadProcessId(hwnd, ct.byref(pid))
    return pid.value

def foreground_display(browser_pid):
    hwnd = user.GetForegroundWindow()
    if not hwnd or pid_for(hwnd) != browser_pid:
        return None
    monitor = user.MonitorFromWindow(hwnd, 0)
    info = MonitorInfo()
    info.size = ct.sizeof(info)
    if monitor and user.GetMonitorInfoW(monitor, ct.byref(info)):
        return info.device
    return None

def activate_benchmark(browser_pid):
    windows = []
    @ct.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
    def collect(hwnd, unused):
        if pid_for(hwnd) == browser_pid and user.IsWindowVisible(hwnd):
            title = ct.create_unicode_buffer(160)
            user.GetWindowTextW(wt.HWND(hwnd), title, len(title))
            if "Sphere cadence [" in title.value:
                windows.append(hwnd)
        return True
    user.EnumWindows(collect, 0)
    if not windows:
        return
    hwnd = windows[0]
    if user.IsIconic(hwnd):
        user.ShowWindow(hwnd, 9)  # SW_RESTORE
    if user.SetForegroundWindow(hwnd):
        return
    # Activate only our own Chrome window, before sampling, then release the input queues.
    caller = ct.windll.kernel32.GetCurrentThreadId()
    current = user.GetForegroundWindow()
    threads = {user.GetWindowThreadProcessId(hwnd, None), user.GetWindowThreadProcessId(current, None)}
    joined = [tid for tid in threads if tid and tid != caller and user.AttachThreadInput(caller, tid, True)]
    try:
        user.BringWindowToTop(hwnd)
        user.SetForegroundWindow(hwnd)
    finally:
        for tid in joined:
            user.AttachThreadInput(caller, tid, False)

def run(output):
    root = Path(__file__).resolve().parents[1]
    monitors = displays()
    points = []
    qualified_display = None
    with tempfile.TemporaryDirectory(prefix="sphere-focus-") as tmp:
        folder = Path(tmp)
        env = {**os.environ, "SPHERE_CADENCE_FOCUS_DIR": tmp}
        proc = subprocess.Popen(["node", "tools/measure-frame-cadence.cjs", str(output)], cwd=root, env=env)
        pid, consecutive, last_attempt = 0, 0, 0.0
        try:
            for label in ("blank", "standalone", "visit"):
                signal = folder / (label + ".request")
                while proc.poll() is None and not signal.exists():
                    points.append([round(time.time() * 1000), foreground_display(pid)])
                    time.sleep(.15)
                if proc.poll() is not None:
                    break
                pid = int(signal.read_text())
                consecutive = 0
                while proc.poll() is None and consecutive < 3:
                    device = foreground_display(pid)
                    consecutive = consecutive + 1 if device and device in {d["device"] for d in monitors} else 0
                    if not device and time.monotonic() - last_attempt > 2:
                        activate_benchmark(pid)
                        last_attempt = time.monotonic()
                    time.sleep(.15)
                if consecutive < 3:
                    break
                qualified_display = qualified_display or device
                if device != qualified_display:
                    raise RuntimeError("Chrome moved between displays before " + label)
                (folder / (label + ".ready")).touch()
            while proc.poll() is None:
                points.append([round(time.time() * 1000), foreground_display(pid)])
                time.sleep(.15)
        finally:
            if proc.poll() is None:
                proc.terminate()
            proc.wait()
    if proc.returncode:
        return proc.returncode
    samples = []
    for row in json.loads(output.read_text())["samples"]:
        start, end = row["fromUnixMs"], row["toUnixMs"]
        inside = [(stamp, device) for stamp, device in points if start <= stamp <= end]
        stamps = [start, *(stamp for stamp, _ in inside), end]
        gap = max(b-a for a, b in zip(stamps, stamps[1:]))
        matched = sum(device == qualified_display for _, device in inside)
        valid = bool(inside) and matched == len(inside) and gap < 750
        samples.append(dict(label=row["label"], observations=len(inside), matched=matched, maxGapMs=round(gap, 1), passed=valid))
        print(row["label"], "foreground on", qualified_display, matched, "/", len(inside), flush=True)
    sidecar = dict(displays=monitors, benchmarkDisplay=qualified_display, samples=samples, observations=points)
    output.with_suffix(".display.json").write_text(json.dumps(sidecar) + "\n", encoding="utf-8")
    return 0 if len(samples) == 3 and all(row["passed"] for row in samples) else 1

if __name__ == "__main__":
    sys.exit(run(Path(sys.argv[1]).resolve()))
