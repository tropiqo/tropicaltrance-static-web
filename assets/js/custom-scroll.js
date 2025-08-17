document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      const targetId = href.startsWith("/#") ? href.slice(1) : href; // remove leading slash if needed
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
});
// document.addEventListener("DOMContentLoaded", function () {
//     document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(anchor => {
//       anchor.addEventListener("click", function (e) {
//         const targetId = this.getAttribute("href").replace("/", "");
//         const target = document.querySelector(targetId);
//         if (target) {
//           e.preventDefault();
//           target.scrollIntoView({ behavior: "smooth" });
//         }
//       });
//     });
//   });
  