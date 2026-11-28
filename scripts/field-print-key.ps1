param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{16}$')][string]$Scope)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

public sealed class ObservatoryPrintKey : ApplicationContext {
    const int PrintScreen = 0x2c;
    delegate IntPtr KeyProc(int code, IntPtr msg, IntPtr data);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder title, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out int process);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int id, KeyProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr msg,IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    readonly KeyProc onKey;
    readonly Timer timer = new Timer();
    readonly Regex titlePattern;
    IntPtr hook, watched;
    string lastStatus;
    string tab, pressed;
    public ObservatoryPrintKey(string scope) {
        titlePattern=new Regex(@"\[Sphere "+Regex.Escape(scope)+@" ([a-f0-9]{16})\]");
        onKey=OnKey;
        timer.Interval=75;timer.Tick+=(s,e)=>UpdateForeground();timer.Start();
        UpdateForeground();
    }
    string Target(IntPtr window) {
        if(window==IntPtr.Zero)return null;
        var title=new StringBuilder(512);
        GetWindowText(window,title,title.Capacity);
        var match=titlePattern.Match(title.ToString());
        if(!match.Success)return null;
        int pid;GetWindowThreadProcessId(window,out pid);
        try {
            using(var process=Process.GetProcessById(pid)){
                var name=process.ProcessName.ToLowerInvariant();
                if(name!="chrome"&&name!="msedge"&&name!="firefox"&&name!="brave")return null;
            }
        } catch(ArgumentException){return null;}
        return match.Groups[1].Value;
    }
    void UpdateForeground() {
        var window=GetForegroundWindow();
        var next=Target(window);
        if(watched==window&&tab==next&&((next==null)||(hook!=IntPtr.Zero)))return;
        if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}
        watched=window;tab=next;pressed=null;
        if(tab==null){lastStatus=null;return;}
        hook=SetWindowsHookEx(13,onKey,GetModuleHandle(null),0);
        string status=hook!=IntPtr.Zero?"armed "+tab:"unavailable "+tab+" "+Marshal.GetLastWin32Error();
        if(status!=lastStatus){Console.WriteLine(status);Console.Out.Flush();lastStatus=status;}
    }
    IntPtr OnKey(int code,IntPtr message,IntPtr data) {
        // All other keys and all other windows pass straight through.
        if(code>=0 && Marshal.ReadInt32(data)==PrintScreen &&
           watched==GetForegroundWindow() && tab!=null && Target(watched)==tab) {
            int m=message.ToInt32();
            if(m==0x101 && pressed==tab){pressed=null;Console.WriteLine(tab);Console.Out.Flush();return new IntPtr(1);}
            if(m==0x100 && GetAsyncKeyState(0x10)>=0 && GetAsyncKeyState(0x11)>=0 &&
               GetAsyncKeyState(0x12)>=0 && GetAsyncKeyState(0x5b)>=0 && GetAsyncKeyState(0x5c)>=0){
                pressed=tab;return new IntPtr(1);
            }
        }
        return CallNextHookEx(hook,code,message,data);
    }
    protected override void Dispose(bool disposing) {
        if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);
        if(disposing)timer.Dispose();
        base.Dispose(disposing);
    }
    public static void Run(string scope){using(var app=new ObservatoryPrintKey(scope))Application.Run(app);}
}
"@
[ObservatoryPrintKey]::Run($Scope)
