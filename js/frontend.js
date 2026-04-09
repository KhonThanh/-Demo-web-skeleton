// ----------- Vùng chức năng -------------
// 🧩 1️⃣ Include HTML Components
function includeHTML(callback) {
  const elements = document.querySelectorAll("[data-include]");
  if (!elements.length) {
    if (callback) callback();
    return;
  }

  let loaded = 0;

  Promise.all([...elements].map(async (el) => {
    const file = el.getAttribute("data-include");
    if (!file) return;

    // Sử dụng versioning thay vì cache-busting bằng Date.now() để tận dụng cache trình duyệt
    const version = "1.0.0"; // Thay đổi version này khi có cập nhật component
    const cacheKey = `comp-${file}-${version}`;
    let html = sessionStorage.getItem(cacheKey);

    if (!html) {
      // Xóa cache cũ của component này nếu có
      Object.keys(sessionStorage).forEach(key => { if (key.startsWith(`comp-${file}`)) sessionStorage.removeItem(key); });
      const res = await fetch(file, { cache: "reload" }); // Tải lại file mới nhất từ server
      html = await res.text();
      sessionStorage.setItem(cacheKey, html);
    }

    el.innerHTML = html;
    if (typeof initResponsive === "function") initResponsive(el);

    if (++loaded === elements.length) {
      document.dispatchEvent(new Event("includesLoaded"));
      if (callback) callback();
    }
  }));
}

// js thêm active
function initToggleSystem(configs = []) {
  if (!window._toggleSystemState) {
    window._toggleSystemState = { docKeys: new Set(), keyKeys: new Set() };
  }
  const state = window._toggleSystemState;

  configs.forEach((cfg, cfgIndex) => {
    if (!cfg || !cfg.trigger) return;

    const activeClass = cfg.activeClass || "active";
    const behavior = cfg.behavior || "toggle";
    const closeOnOutside = !!cfg.closeOnOutside;
    const closeOnEsc = !!cfg.closeOnEsc;
    const overlayCloses = !!cfg.overlayCloses;
    const innerSelector = cfg.innerSelector || null;
    const closeBtnSelector = cfg.closeBtn || null;
    const groupSelector = cfg.groupSelector || null;

    const triggers = Array.from(document.querySelectorAll(cfg.trigger));
    if (!triggers.length) return;

    const targets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];

    const closeAll = () => {
      targets.forEach(t => t.classList.remove(activeClass));
      triggers.forEach(t => t.classList.remove(activeClass));
    };

    // bind sự kiện click cho từng trigger (chỉ bind 1 lần)
    triggers.forEach((trigger, idx) => {
      if (trigger.dataset._toggleBound === "true") return;
      trigger.dataset._toggleBound = "true";

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();

        // Tìm target element ứng với trigger (nếu có)
        let targetEl = null;
        if (cfg.target) {
          if (trigger.dataset && trigger.dataset.target) {
            targetEl = document.querySelector(trigger.dataset.target);
          } else {
            targetEl = targets[idx] || targets[0] || null;
          }
        }

        // ---- behavior activate (tab-like) ----
        if (behavior === "activate") {
          if (groupSelector) {
            document.querySelectorAll(groupSelector).forEach(el => el.classList.remove(activeClass));
          } else {
            triggers.forEach(t => t.classList.remove(activeClass));
          }
          trigger.classList.add(activeClass);

          if (targets.length > 0 && targetEl) {
            targets.forEach(t => t.classList.remove(activeClass));
            targetEl.classList.add(activeClass);
          }
        }

        // ---- toggle mode ----
        else {
          if (targetEl) targetEl.classList.toggle(activeClass);
          else trigger.classList.toggle(activeClass);
        }

        // callback onToggle (nếu có)
        if (typeof cfg.onToggle === "function") {
          try { cfg.onToggle(trigger, idx); } catch (err) { /* ignore */ }
        }

        // -> GỌI onActiveChange bất kể có target hay không
        if (typeof cfg.onActiveChange === "function") {
          const isActive = targetEl ? targetEl.classList.contains(activeClass) : trigger.classList.contains(activeClass);
          try { cfg.onActiveChange(isActive, trigger, targetEl, idx); } catch (err) { /* ignore */ }
        }
      });
    });

    // bind nút đóng (nhiều selector)
    if (closeBtnSelector) {
      Array.from(document.querySelectorAll(closeBtnSelector)).forEach(btn => {
        if (btn.dataset._toggleCloseBound === "true") return;
        btn.dataset._toggleCloseBound = "true";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          closeAll();
        });
      });
    }

    // click outside để đóng
    if (closeOnOutside) {
      const docKey = `doc_${cfg.trigger}|${cfg.target || ""}|${cfgIndex}`;
      if (!state.docKeys.has(docKey)) {
        state.docKeys.add(docKey);
        document.addEventListener("click", (e) => {
          const currTriggers = Array.from(document.querySelectorAll(cfg.trigger));
          const currTargets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];

          const clickedOnTrigger = currTriggers.some(t => t.contains(e.target));
          const clickedOnOverlay = overlayCloses && currTargets.some(t => e.target === t);

          const clickedInsideTarget = currTargets.some(t => {
            const inner = innerSelector ? t.querySelector(innerSelector) : t;
            return inner && inner.contains(e.target);
          });

          if (clickedOnOverlay) {
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
            return;
          }

          if (!clickedInsideTarget && !clickedOnTrigger) {
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
          }
        });
      }
    }

    // ESC để đóng
    if (closeOnEsc) {
      const escKey = `esc_${cfg.trigger}|${cfg.target || ""}|${cfgIndex}`;
      if (!state.keyKeys.has(escKey)) {
        state.keyKeys.add(escKey);
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            const currTargets = cfg.target ? Array.from(document.querySelectorAll(cfg.target)) : [];
            const currTriggers = Array.from(document.querySelectorAll(cfg.trigger));
            currTargets.forEach(t => t.classList.remove(activeClass));
            currTriggers.forEach(t => t.classList.remove(activeClass));
          }
        });
      }
    }

    // === gọi onActiveChange cho trạng thái ban đầu (nếu có active sẵn trong DOM) ===
    if (typeof cfg.onActiveChange === "function") {
      // delay một tick để đảm bảo các class có sẵn đã gán xong (nếu include động)
      setTimeout(() => {
        Array.from(document.querySelectorAll(cfg.trigger)).forEach((tr, i) => {
          const targetEl = cfg.target ? (document.querySelectorAll(cfg.target)[i] || document.querySelectorAll(cfg.target)[0]) : null;
          const isActive = targetEl ? targetEl.classList.contains(activeClass) : tr.classList.contains(activeClass);
          if (isActive) {
            try { cfg.onActiveChange(true, tr, targetEl, i); } catch (err) { }
          }
        });
      }, 0);
    }
  });
}

// 🖼️ 2️⃣ Lazy Load + Set Dimensions
function applyImageEnhancements(root = document) {
  root.querySelectorAll("img").forEach(img => {
    // Lazy load
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");

    // Alt text
    if (!img.hasAttribute("alt") || img.alt.trim() === "") {
      const fileName = img.src.split("/").pop().split(".")[0] || "image";
      img.setAttribute("alt", fileName.replace(/[-_]/g, " "));
    }

    // Hàm set kích thước an toàn
    const setDim = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        if (!img.hasAttribute("width")) img.setAttribute("width", img.naturalWidth);
        if (!img.hasAttribute("height")) img.setAttribute("height", img.naturalHeight);
      }
    };

    // Nếu ảnh đã load sẵn (cache hoặc render sớm)
    if (img.complete) setTimeout(setDim, 50);
    else img.addEventListener("load", setDim);

    // Chỉ xử lý khi xuất hiện trong viewport
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setDim();
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "200px 0px" });
    io.observe(img);
  });
}

// ✨ 3️⃣ Scroll Reveal Effect
function initRevealEffect() {
  const sections = document.querySelectorAll("section, footer");
  if (!sections.length) return;

  sections.forEach(sec => sec.classList.add("hidden-section"));

  let revealIndex = 0;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.transitionDelay = `${revealIndex * 20}ms`;
        revealIndex++;
        el.classList.add("show-up");
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -10% 0px" });

  sections.forEach(sec => observer.observe(sec));
}

// 🧩 1️⃣ Hàm dùng chung cho tất cả slick
function initSlickSlider({
  mainSelector,
  navSelector = null,
  minSlides = 0,
  mainOptions = {},
  navOptions = {},
  prevBtnSelector = null,
  nextBtnSelector = null
}) {
  const $main = $(mainSelector);
  if (!$main.length) return;

  // --- Helper: clone thêm slide nếu ít hơn minSlides ---
  const ensureMinSlides = ($el, minCount) => {
    const $items = $el.children();
    let count = $items.length;
    let i = 0;
    while (count < minCount) {
      $el.append($items.eq(i % $items.length).clone());
      count++;
      i++;
    }
  };

  // --- Có nav → slider kép ---
  if (navSelector) {
    const $nav = $(navSelector);
    if (!$nav.length) return;

    if (minSlides > 0) ensureMinSlides($nav, minSlides);

    if (!$main.hasClass("slick-initialized")) {
      $main.slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        fade: true,
        infinite: true,
        arrows: false,
        asNavFor: navSelector,
        ...mainOptions
      });
    }

    if (!$nav.hasClass("slick-initialized")) {
      $nav.slick({
        slidesToShow: 8,
        slidesToScroll: 1,
        focusOnSelect: true,
        infinite: true,
        arrows: false,
        centerMode: true,
        centerPadding: "0px",
        asNavFor: mainSelector,
        ...navOptions
      });
    }

    // --- Nút prev/next riêng (nếu có) ---
    if (prevBtnSelector) {
      const prevBtn = document.querySelector(prevBtnSelector);
      if (prevBtn) prevBtn.addEventListener("click", () => $main.slick("slickPrev"));
    }

    if (nextBtnSelector) {
      const nextBtn = document.querySelector(nextBtnSelector);
      if (nextBtn) nextBtn.addEventListener("click", () => $main.slick("slickNext"));
    }
  }

  // --- Không có nav → slider đơn ---
  else {
    if (minSlides > 0) ensureMinSlides($main, minSlides);

    if (!$main.hasClass("slick-initialized")) {
      $main.slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: true,
        infinite: true,
        ...mainOptions
      });
    }

    if (prevBtnSelector) {
      const prevBtn = document.querySelector(prevBtnSelector);
      if (prevBtn) prevBtn.addEventListener("click", () => $main.slick("slickPrev"));
    }

    if (nextBtnSelector) {
      const nextBtn = document.querySelector(nextBtnSelector);
      if (nextBtn) nextBtn.addEventListener("click", () => $main.slick("slickNext"));
    }
  }
}


// chức năng đổi tên và gán link vào a và đạc biệt thêm thẻ li a vào mục lục bài viét
function generateHeadingLinks({
  contentSelector,
  outputSelector = null,
  linkSelector = null,
  toggleSelector = null
}) {
  const content = document.querySelector(contentSelector);
  if (!content) return;

  const headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (!headings.length) return;

  const toSlug = str => str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "")
    .toLowerCase();

  headings.forEach((h, i) => {
    const text = h.textContent.trim();
    const id = toSlug(text) || `heading-${i}`;
    h.id = id;
  });

  if (outputSelector) {
    const tocBody = document.querySelector(outputSelector);
    if (tocBody) {
      tocBody.innerHTML = "";
      headings.forEach(h => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `#${h.id}`;
        a.textContent = h.textContent.trim();
        li.appendChild(a);
        tocBody.appendChild(li);
      });
    }


    if (toggleSelector && tocBody) {
      const toggle = document.querySelector(toggleSelector);
      toggle.addEventListener("click", e => {
        e.stopPropagation();
        tocBody.classList.toggle("open");
      });
      document.addEventListener("click", e => {
        if (!e.target.closest(toggleSelector)) tocBody.classList.remove("open");
      });
    }
  }


  if (linkSelector) {
    const links = document.querySelectorAll(linkSelector);
    const count = Math.min(headings.length, links.length);
    for (let i = 0; i < count; i++) {
      const heading = headings[i];
      const link = links[i];
      link.setAttribute("href", `#${heading.id}`);
      link.addEventListener("click", e => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
}

// 🧩 2️⃣ Hàm dùng chung cho tất cả Swiper
function initSwiperSlider({
  mainSelector,
  minSlides = 0, // Số lượng slide tối thiểu cần có để loop mượt mà (nếu loop: true)
  autoplay = false, // false, true, hoặc object { delay: 2500, disableOnInteraction: false }
  spaceBetween = 0, // Khoảng cách giữa các slide
  slidesPerView = 1, // Số lượng slide hiển thị trên mỗi view
  loop = false, // Bật/tắt chế độ lặp vô hạn
  navigation = { // Cấu hình nút điều hướng
    nextEl: null, // Selector của nút next
    prevEl: null  // Selector của nút prev
  },
  pagination = { // Cấu hình phân trang (dots)
    el: null,     // Selector của container chứa dots
    clickable: true // Cho phép click vào dots để chuyển slide
  },
  breakpoints = null, // Cấu hình responsive
  ...extraOptions // Các tùy chọn Swiper khác
}) {
  const swiperContainer = document.querySelector(mainSelector);
  if (!swiperContainer) {
    console.warn(`Swiper container not found for selector: ${mainSelector}`);
    return;
  }

  // Nếu loop được bật và minSlides được chỉ định, đảm bảo đủ slide để vòng lặp mượt mà
  if (loop && minSlides > 0) {
    const wrapper = swiperContainer.querySelector('.swiper-wrapper');
    if (wrapper) {
      const slides = Array.from(wrapper.children);
      let currentSlideCount = slides.length;
      // Swiper cần ít nhất slidesPerView * 2 (hoặc hơn) để loop mượt mà khi slidesPerView > 1
      // Nếu slidesPerView = 1, cần ít nhất 2-3 slide
      const requiredForLoop = slidesPerView > 1 ? slidesPerView * 2 : 3;
      const actualMin = Math.max(minSlides, requiredForLoop);

      if (currentSlideCount < actualMin) {
        for (let i = 0; i < actualMin - currentSlideCount; i++) {
          wrapper.appendChild(slides[i % currentSlideCount].cloneNode(true));
        }
      }
    }
  }

  const swiperOptions = {
    slidesPerView: slidesPerView,
    spaceBetween: spaceBetween,
    loop: loop,
    autoplay: autoplay ? {
      delay: typeof autoplay === 'number' ? autoplay : 2500,
      disableOnInteraction: false,
      ...(typeof autoplay === 'object' ? autoplay : {})
    } : false,
    navigation: navigation.nextEl || navigation.prevEl ? navigation : false,
    pagination: pagination.el ? pagination : false,
    breakpoints: breakpoints,
    ...extraOptions
  };

  new Swiper(swiperContainer, swiperOptions);
}

// js roll to top
function initScrollToTop(btnId = "btnToTop", showOffset = 1000) {
  const scrollBtn = document.getElementById(btnId);
  if (!scrollBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > showOffset) {
      scrollBtn.classList.add("show");
    } else {
      scrollBtn.classList.remove("show");
    }
  });

  scrollBtn.addEventListener("click", () => {
    window.scroll({
      top: 0,
      behavior: "smooth",
    });
  });
}

// js validate form
function validateField(input) {
  const group = input.closest(".form-group");
  const error = group?.querySelector(".error-msg");
  let message = "";

  const value = input.value.trim();

  if (input.hasAttribute("required") && !value) {
    message = input.dataset.msg || "Vui lòng không để trống";
  }

  if (!message && input.type === "email" && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) message = "Email không hợp lệ";
  }

  if (!message && input.hasAttribute("minlength")) {
    const min = +input.getAttribute("minlength");
    if (value.length < min) {
      message = input.dataset.msg || `Tối thiểu ${min} ký tự`;
    }
  }

  if (!message && input.tagName === "SELECT" && input.required) {
    if (!input.value) message = "Vui lòng chọn một giá trị";
  }

  if (!message && input.type === "checkbox" && input.required) {
    if (!input.checked) message = "Vui lòng xác nhận";
  }

  if (!message && input.pattern && input.value) {
    const regex = new RegExp(input.pattern);
    if (!regex.test(input.value)) {
      message = input.dataset.msg || "Giá trị không hợp lệ";
    }
  }

  if (group) group.classList.toggle("error", !!message);
  if (error) error.textContent = message;

  return !message;
}

function validateForm(form) {
  let isValid = true;
  form.querySelectorAll("input, textarea").forEach(input => {
    if (!validateField(input)) isValid = false;
  });
  return isValid;
}

function initFormValidation(root = document) {
  root.querySelectorAll(".js-validate-form").forEach(form => {
    if (form.dataset._validated) return;
    form.dataset._validated = "true";

    form.querySelectorAll("input, textarea").forEach(input => {
      input.addEventListener("input", () => validateField(input));
    });

    form.addEventListener("submit", e => {
      if (!validateForm(form)) e.preventDefault();
    });
  });
}

// ----------- Vùng gọi biến --------------
document.addEventListener("DOMContentLoaded", () => {
  includeHTML(() => {
    // 📚 1️⃣ MỤC LỤC & MENU LIÊN KẾT
    generateHeadingLinks({
      contentSelector: ".blog-content",
      outputSelector: ".table-heading__body ul",
      toggleSelector: ".table-heading__top"
    });
    generateHeadingLinks({
      contentSelector: "#intro-content",
      linkSelector: ".menu-shortcut__container .intro-banner__shortcut"
    });
    // 🟢 Slide banner chính (chuyển sang Swiper)
    initSwiperSlider({
      mainSelector: '.slide-container',
      minSlides: 3, // Đảm bảo có ít nhất 3 slide để loop mượt mà
      autoplay: { delay: 3000, disableOnInteraction: false }, // Tự động chạy sau 3 giây
      loop: true, // Bật vòng lặp vô hạn
      slidesPerView: 1, // Hiển thị 1 slide
      spaceBetween: 0, // Không có khoảng cách
      pagination: {
        el: '.swiper-pagination.custom-dots', // Selector cho dots
        clickable: true,
      },
    });

    initSwiperSlider({
      mainSelector: '.service-list',
      minSlides: 8, 
      autoplay: { delay: 4000, disableOnInteraction: false },
      loop: true,
      slidesPerView: 1, // Mặc định cho mobile
      spaceBetween: 20,
      navigation: {
        nextEl: '.service-list .swiper-button-next',
        prevEl: '.service-list .swiper-button-prev',
      },
      pagination: {
        el: '.service-list .swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        500: { slidesPerView: 2, spaceBetween: 20 },
        768: { slidesPerView: 3, spaceBetween: 20 },
        1200: { slidesPerView: 4, spaceBetween: 20 },
      },
    });

    // 📰 Slide tin tức (Swiper)
    initSwiperSlider({
      mainSelector: '.news-list',
      minSlides: 6, // Đảm bảo đủ slide cho loop mượt mà trên desktop (3 slidesPerView * 2)
      autoplay: { delay: 4000, disableOnInteraction: false },
      loop: true,
      slidesPerView: 1, // Mặc định cho mobile
      spaceBetween: 20,
      navigation: {
        nextEl: '.news-list .swiper-button-next',
        prevEl: '.news-list .swiper-button-prev',
      },
      pagination: {
        el: '.news-list .swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 2, spaceBetween: 20 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
      },
    });
    
    initToggleSystem([
      {
        trigger: ".pagination-btn__custom.page-num",
        behavior: "activate",
        activeClass: "active",
      },
      {
        trigger: ".menu-container__bar",
        target: ".m-menu",
        behavior: "toggle",
        activeClass: "active",
        closeOnOutside: true,
        closeOnEsc: true,
        innerSelector: ".m-menu__link" // Đảm bảo click bên trong menu không bị đóng
      },
      {
        trigger: ".news-detail__content h3",
        behavior: "activate", // 'activate' tự động xử lý việc chỉ có 1 item active
        activeClass: "active",
      },
    ]);
    // 🟡 roll to the top
    initScrollToTop();
    // ✨ 4️⃣ HIỆU ỨNG ẢNH & REVEAL
    applyImageEnhancements();
    initRevealEffect();
    initFormValidation();
  });
});

// 🔁 Cập nhật khi include hoặc slick load lại
document.addEventListener("includesLoaded", () => applyImageEnhancements());
$(document).on("init reInit afterChange", ".slick-slider", function () {
  applyImageEnhancements(this);
});
