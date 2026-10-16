(() => {
  const config = window.KONGU_CONFIG || {};
  const apiBase = (config.API_BASE_URL || "").replace(/\/+$/, "");
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.textContent = open ? "×" : "☰";
    });
    navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.textContent = "☰";
    }));
  }
  document.getElementById("year").textContent = new Date().getFullYear();
  document.querySelectorAll("[data-job]").forEach(link => {
    link.addEventListener("click", () => {
      const select = document.querySelector('[name="jobCategory"]');
      if (select) select.value = link.dataset.job;
    });
  });
  const form = document.getElementById("applicationForm");
  const message = document.getElementById("formMessage");
  const submit = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("error");
    if (!apiBase || apiBase.includes("YOUR-BACKEND-HOST")) {
      message.textContent = "Website setup is not complete yet. Please contact us by WhatsApp while the application system is being connected.";
      message.classList.add("error");
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = form.elements.consent.checked;
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = "<span>Submitting…</span>";
    try {
      const response = await fetch(`${apiBase}/api/applications`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit your application. Please try again.");
      form.reset();
      message.textContent = `Thank you! Your application reference is ${result.applicationId}. We will review your details.`;
    } catch (error) {
      message.textContent = error.message || "Network issue. Please try again or contact us on WhatsApp.";
      message.classList.add("error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });
})();
