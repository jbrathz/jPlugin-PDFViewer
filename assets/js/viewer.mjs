/**
 * jPlugin-PDFViewer - Viewer Script v1.0.1
 * แปลง <object> PDF embeds ของ WordPress เป็น PDF.js canvas viewer
 * แก้ปัญหา X-Frame-Options: DENY บน Chrome/Edge
 */
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        var checkReady = setInterval(function () {
            if (window._jpdfLib) {
                clearInterval(checkReady);
                run(window._jpdfLib);
            }
        }, 100);
        setTimeout(function () { clearInterval(checkReady); }, 10000);
    });

    function run(pdfjsLib) {
        var objects = document.querySelectorAll(
            'object.wp-block-file__embed[type="application/pdf"]'
        );
        if (objects.length === 0) return;
        objects.forEach(function (obj) {
            initViewer(pdfjsLib, obj);
        });
    }

    function initViewer(pdfjsLib, obj) {
        var pdfUrl = obj.getAttribute("data");
        if (!pdfUrl) return;

        if (pdfUrl.startsWith("/")) {
            pdfUrl = window.location.origin + pdfUrl;
        }

        // สร้าง container
        var container = document.createElement("div");
        container.className = "jpdf-viewer-container";

        // Toolbar (ไม่มีปุ่ม download)
        var toolbar = document.createElement("div");
        toolbar.className = "jpdf-toolbar";
        toolbar.innerHTML =
            '<button class="jpdf-prev" disabled title="หน้าก่อน">◀</button>' +
            '<span class="jpdf-page-info">กำลังโหลด...</span>' +
            '<button class="jpdf-next" disabled title="หน้าถัดไป">▶</button>' +
            '<span class="jpdf-separator">|</span>' +
            '<button class="jpdf-zoom-out" title="ย่อ">−</button>' +
            '<span class="jpdf-zoom-info">พอดีหน้า</span>' +
            '<button class="jpdf-zoom-in" title="ขยาย">+</button>';
        container.appendChild(toolbar);

        // Canvas wrapper
        var canvasWrapper = document.createElement("div");
        canvasWrapper.className = "jpdf-canvas-wrapper";
        var canvas = document.createElement("canvas");
        canvasWrapper.appendChild(canvas);
        container.appendChild(canvasWrapper);

        // แทนที่ <object>
        obj.parentNode.replaceChild(container, obj);

        // State
        var state = {
            pdfDoc: null,
            currentPage: 1,
            scale: null, // จะคำนวณ fit-width ตอน render
            rendering: false,
        };

        var ctx = canvas.getContext("2d");
        var prevBtn = toolbar.querySelector(".jpdf-prev");
        var nextBtn = toolbar.querySelector(".jpdf-next");
        var pageInfo = toolbar.querySelector(".jpdf-page-info");
        var zoomInBtn = toolbar.querySelector(".jpdf-zoom-in");
        var zoomOutBtn = toolbar.querySelector(".jpdf-zoom-out");
        var zoomInfo = toolbar.querySelector(".jpdf-zoom-info");

        // โหลด PDF
        pdfjsLib
            .getDocument(pdfUrl)
            .promise.then(function (pdf) {
                state.pdfDoc = pdf;
                renderPage(state.currentPage);
            })
            .catch(function (err) {
                pageInfo.textContent = "ไม่สามารถโหลด PDF ได้";
                pageInfo.style.color = "#ff6b6b";
                console.error("[jPlugin-PDFViewer]", err);
            });

        function renderPage(num) {
            if (state.rendering) return;
            state.rendering = true;

            state.pdfDoc.getPage(num).then(function (page) {
                // คำนวณ scale ให้พอดีกับความกว้าง container (fit-width)
                if (state.scale === null) {
                    var containerWidth = canvasWrapper.clientWidth - 32; // ลบ padding
                    var defaultViewport = page.getViewport({ scale: 1.0 });
                    state.scale = containerWidth / defaultViewport.width;
                }

                var viewport = page.getViewport({ scale: state.scale });

                // ตั้ง pixel ratio ให้ชัด
                var ratio = window.devicePixelRatio || 1;
                canvas.width = viewport.width * ratio;
                canvas.height = viewport.height * ratio;
                canvas.style.width = viewport.width + "px";
                canvas.style.height = viewport.height + "px";
                ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

                page.render({ canvasContext: ctx, viewport: viewport })
                    .promise.then(function () {
                        state.rendering = false;
                        state.currentPage = num;
                        updateUI();
                    });
            });
        }

        function updateUI() {
            pageInfo.textContent = state.currentPage + " / " + state.pdfDoc.numPages;
            prevBtn.disabled = state.currentPage <= 1;
            nextBtn.disabled = state.currentPage >= state.pdfDoc.numPages;
            zoomInfo.textContent = Math.round(state.scale * 100) + "%";
        }

        prevBtn.addEventListener("click", function () {
            if (state.currentPage > 1) renderPage(state.currentPage - 1);
        });

        nextBtn.addEventListener("click", function () {
            if (state.pdfDoc && state.currentPage < state.pdfDoc.numPages) {
                renderPage(state.currentPage + 1);
            }
        });

        zoomInBtn.addEventListener("click", function () {
            if (state.scale < 3.0) {
                state.scale = Math.min(state.scale + 0.25, 3.0);
                renderPage(state.currentPage);
            }
        });

        zoomOutBtn.addEventListener("click", function () {
            if (state.scale > 0.5) {
                state.scale = Math.max(state.scale - 0.25, 0.5);
                renderPage(state.currentPage);
            }
        });
    }
})();
