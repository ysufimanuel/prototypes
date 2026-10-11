const sync=()=>document.querySelectorAll("#website-navigation-list [data-nav]").forEach(el=>el.setAttribute("data-v2-nav",el.getAttribute("data-nav")));
sync();new MutationObserver(sync).observe(document.getElementById("website-navigation-list")||document.body,{childList:true,subtree:true});
