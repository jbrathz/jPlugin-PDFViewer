/**
 * jPlugin-PDFViewer - Viewer Script v1.0.1
 * แปลง <object> PDF embeds ของ WordPress เป็น PDF.js canvas viewer
 * แก้ปัญหา X-Frame-Options: DENY บน Chrome/Edge
 */
(function () {
    "use strict";

    var PROCESSED_ATTR = "data-jpdf-processed";
    var pdfjsPromise = null;

    onReady(function () {
        bootstrap(document);
    });

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function bootstrap(rootDocument) {
        ensurePdfLib()
            .then(function (pdfjsLib) {
                run(pdfjsLib, rootDocument);
                observeMutations(pdfjsLib, rootDocument);
            })
            .catch(function (err) {
                console.error("[jPlugin-PDFViewer]", err);
            });
    }

    function ensurePdfLib() {
        if (window._jpdfLib) {
            return Promise.resolve(window._jpdfLib);
        }

        if (pdfjsPromise) {
            return pdfjsPromise;
        }

        var config = window.jpdfViewerConfig || {};
        if (!config.pdfjsUrl || !config.workerUrl) {
            return Promise.reject(new Error("jpdfViewerConfig is missing."));
        }

        pdfjsPromise = import(config.pdfjsUrl).then(function (pdfModule) {
            var pdfjsLib = pdfModule && pdfModule.getDocument ? pdfModule : pdfModule.default;
            if (!pdfjsLib || !pdfjsLib.getDocument) {
                throw new Error("Unable to initialize PDF.js library.");
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc = config.workerUrl;
            window._jpdfLib = pdfjsLib;
            return pdfjsLib;
        });

        return pdfjsPromise;
    }

    function run(pdfjsLib, rootDocument) {
        var objects = rootDocument.querySelectorAll('object[type="application/pdf"]');
        if (objects.length === 0) {
            return;
        }

        objects.forEach(function (obj) {
            initViewer(pdfjsLib, obj);
        });
    }

    function observeMutations(pdfjsLib, rootDocument) {
        if (!rootDocument.body || typeof MutationObserver === "undefined") {
            return;
        }

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    processNode(pdfjsLib, node);
                });
            });
        });

        observer.observe(rootDocument.body, {
            childList: true,
            subtree: true,
        });
    }

    function processNode(pdfjsLib, node) {
        if (!node || node.nodeType !== 1) {
            return;
        }

        if (node.matches && node.matches('object[type="application/pdf"]')) {
            initViewer(pdfjsLib, node);
        }

        if (!node.querySelectorAll) {
            return;
        }

        var nestedObjects = node.querySelectorAll('object[type="application/pdf"]');
        nestedObjects.forEach(function (obj) {
            initViewer(pdfjsLib, obj);
        });
    }

    function initViewer(pdfjsLib, obj) {
        if (!obj || obj.getAttribute(PROCESSED_ATTR) === "1") {
            return;
        }

        var pdfUrl = obj.getAttribute("data");
        if (!pdfUrl) {
            return;
        }

        if (!obj.parentNode) {
            return;
        }

        obj.setAttribute(PROCESSED_ATTR, "1");

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
            scale: null,
            rendering: false,
            pendingPage: null,
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
            if (!state.pdfDoc) {
                return;
            }

            if (state.rendering) {
                state.pendingPage = num;
                return;
            }

            state.rendering = true;

            state.pdfDoc
                .getPage(num)
                .then(function (page) {
                    if (state.scale === null) {
                        var containerWidth = canvasWrapper.clientWidth - 32;
                        var defaultViewport = page.getViewport({ scale: 1.0 });

                        if (containerWidth <= 0) {
                            containerWidth = defaultViewport.width;
                        }

                        state.scale = containerWidth / defaultViewport.width;
                    }

                    var viewport = page.getViewport({ scale: state.scale });

                    var ratio = window.devicePixelRatio || 1;
                    canvas.width = Math.floor(viewport.width * ratio);
                    canvas.height = Math.floor(viewport.height * ratio);
                    canvas.style.width = viewport.width + "px";
                    canvas.style.height = viewport.height + "px";
                    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

                    return page.render({ canvasContext: ctx, viewport: viewport }).promise;
                })
                .then(function () {
                    state.currentPage = num;
                    finishRender();
                })
                .catch(function (err) {
                    pageInfo.textContent = "ไม่สามารถแสดง PDF ได้";
                    pageInfo.style.color = "#ff6b6b";
                    console.error("[jPlugin-PDFViewer]", err);
                    finishRender();
                });
        }

        function finishRender() {
            state.rendering = false;
            updateUI();

            if (state.pendingPage !== null && state.pendingPage !== state.currentPage) {
                var nextPage = state.pendingPage;
                state.pendingPage = null;
                renderPage(nextPage);
                return;
            }

            state.pendingPage = null;
        }

        function updateUI() {
            if (!state.pdfDoc) {
                return;
            }

            pageInfo.textContent = state.currentPage + " / " + state.pdfDoc.numPages;
            prevBtn.disabled = state.currentPage <= 1;
            nextBtn.disabled = state.currentPage >= state.pdfDoc.numPages;
            zoomInfo.textContent = Math.round(state.scale * 100) + "%";
        }

        prevBtn.addEventListener("click", function () {
            if (state.currentPage > 1) {
                renderPage(state.currentPage - 1);
            }
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
