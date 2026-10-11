function initMobileNav() {
  const root = document.getElementById("church-site");
  if (!root) return;
  const header = root.querySelector(".site-header");
  const nav = header?.querySelector("nav");
  const wrap = header?.querySelector(".nav-wrap");
  if (!header || !nav || !wrap || header.dataset.mobileNavReady === "true") return;
  header.dataset.mobileNavReady = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-menu-toggle";
  button.setAttribute("aria-label", "Buka menu");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';

  const drawer = document.createElement("div");
  drawer.className = "mobile-nav-drawer";
  drawer.innerHTML = `<div class="mobile-nav-panel"><div class="mobile-nav-head"><strong>Menu</strong><button type="button" class="mobile-nav-close" aria-label="Tutup menu"><i class="fas fa-times"></i></button></div><div class="mobile-nav-links"></div></div>`;
  const links = drawer.querySelector(".mobile-nav-links");
  nav.querySelectorAll("a").forEach((link) => {
    const clone = link.cloneNode(true);
    clone.addEventListener("click", () => close());
    links.appendChild(clone);
  });

  wrap.appendChild(button);
  header.appendChild(drawer);

  const close = () => {
    drawer.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-nav-open");
  };
  const open = () => {
    drawer.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    document.body.classList.add("mobile-nav-open");
  };
  button.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
  drawer.querySelector(".mobile-nav-close")?.addEventListener("click", close);
  drawer.addEventListener("click", (event) => { if (event.target === drawer) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); }, { passive: true });
}

const observer = new MutationObserver(initMobileNav);
const root = document.getElementById("church-site");
if (root) observer.observe(root, { childList: true, subtree: true });
initMobileNav();
