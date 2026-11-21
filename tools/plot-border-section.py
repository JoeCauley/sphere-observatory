"""Draw the trial station from its resolved Atlas routes. Run from any directory."""
import json
from pathlib import Path
import subprocess
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from matplotlib.lines import Line2D

root = Path(__file__).resolve().parents[1]
source = """import {addressOf,generateStation} from './studies/border-crossing/station.mjs';
console.log(JSON.stringify(generateStation(addressOf('sphere-0000000000000017','r10c0','r11c0',0))));"""
s = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", source], cwd=root))
routes = s["routes"]
colors = ["#268574", "#bb792b", "#5d73a9", "#59585a"]
names = ["Service bridge", "Carrier viaduct", "Heavy-haul bore", "Monumental transfer"]
ink, grid = "#213435", "#d6dfdb"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.right": False, "axes.spines.top": False,
                     "axes.labelcolor": ink, "xtick.color": ink, "ytick.color": ink, "text.color": ink})
fig, (world, hall) = plt.subplots(1, 2, figsize=(13.4, 5.6), gridspec_kw={"width_ratios": [1.6, 1]})
fig.subplots_adjust(top=.76, bottom=.25, left=.075, right=.98, wspace=.22)
fig.suptitle("The transfer yard in section", y=.965, x=.06, ha="left", fontsize=23, fontweight="semibold")
fig.text(.06,.878,"One 48 km crossing, four independently passable routes. The central freight travels along the Border, perpendicular to this section.", fontsize=11)
for ax in (world, hall):
    ax.set_axisbelow(True); ax.grid(True, axis="y", color=grid, linewidth=.7)
    ax.spines["left"].set_color(grid); ax.spines["bottom"].set_color(grid)
world.set_title("Between the two biome faces", loc="left", fontsize=13, pad=11)
world.axvspan((s["widthM"]/2-s["laneHalfM"])/1000,(s["widthM"]/2+s["laneHalfM"])/1000,color="#e4e9e5")
world.plot([0,s["widthM"]/1000],[s["roofM"]]*2,color=ink,linewidth=2)
for route, color in zip(routes, colors):
    world.plot([p[2]/1000 for p in route["points"]],[p[1] for p in route["points"]],color=color,linewidth=2)
world.set_xlim(0,s["widthM"]/1000);world.set_ylim(-300,1880);world.set_xticks([0,8,16,24,32,40,48])
world.set_yticks([0,500,1000,1500,1700]);world.set_xlabel("Distance across Border (km)");world.set_ylabel("Height above freight slab (m)")
world.text(1,1740,"Roof underside",fontsize=9)
hall.set_title("At the center lane · true aspect",loc="left", fontsize=13,pad=11)
hall.set_xlim(-1300,1300);hall.set_ylim(-235,1820);hall.set_aspect("equal",adjustable="box");hall.set_yticks([0,500,1000,1700]);hall.set_xticks([-1000,0,1000])
hall.set_xlabel("Distance from lane center (m)")
hall.add_patch(Rectangle((-1300,1700),2600,40,color=ink))
hall.axhline(0,color=colors[3],lw=2)
for route, color in zip(routes[:3], colors[:3]):
    hall.axhline(route["points"][2][1],color=color,lw=2)
t=s["traffic"]
hall.add_patch(Rectangle((-t["widthM"]/2,0),t["widthM"],t["heightM"],facecolor="#8f9c97",edgecolor=ink))
hall.text(0,t["heightM"]/2,"Freight",ha="center",va="center",fontsize=9)
legend=[Line2D([0],[0],color=color,lw=3,label=name) for name,color in zip(names,colors)]
fig.legend(handles=legend,loc="lower left",bbox_to_anchor=(.06,.07),ncol=4,frameon=False,fontsize=10)
fig.text(.06,.035,"The full-width elevation enlarges height for readability. The center section uses equal units on both axes. Routes at different positions along the wall are projected onto one section.",fontsize=8.7)
out=root/"examples"/"border-crossing"/"transfer-yard-section.png";out.parent.mkdir(parents=True,exist_ok=True)
fig.savefig(out,dpi=160,facecolor="white");plt.close(fig)
