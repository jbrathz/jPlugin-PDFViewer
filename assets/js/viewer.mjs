/**
 * jPlugin-PDFViewer - Viewer Script v1.0.1
 * แปลง <object> PDF embeds ของ WordPress เป็น PDF.js canvas viewer
 * แก้ปัญหา X-Frame-Options: DENY บน Chrome/Edge
 */
(function () {
    "use strict";

    var PROCESSED_ATTR = "data-jpdf-processed";
    var pdfjsPromise = null;
    var observedDocuments = typeof WeakSet !== "undefined" ? new WeakSet() : null;

    onReady(function () {
        startBootstrap(document);
    });

    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function startBootstrap(rootDocument) {
        if (!isDocumentUsable(rootDocument)) {
            return;
        }

        if (isDocumentObserved(rootDocument)) {
            return;
        }

        markDocumentObserved(rootDocument);
        bootstrap(rootDocument);
        observeIframes(rootDocument);
    }

    function isDocumentUsable(rootDocument) {
        return !!(rootDocument && rootDocument.querySelectorAll);
    }

    function isDocumentObserved(rootDocument) {
        if (observedDocuments) {
            return observedDocuments.has(rootDocument);
        }

        return rootDocument.__jpdfObserved === true;
    }

    function markDocumentObserved(rootDocument) {
        if (observedDocuments) {
            observedDocuments.add(rootDocument);
            return;
        }

        rootDocument.__jpdfObserved = true;
    }

    function observeIframes(rootDocument) {
        if (!rootDocument.body) {
            return;
        }

        bindIframes(rootDocument);

        if (typeof MutationObserver === "undefined") {
            return;
        }

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (!node || node.nodeType !== 1) {
                        return;
                    }

                    if (node.matches && node.matches("iframe")) {
                        bindIframe(node);
                    }

                    if (!node.querySelectorAll) {
                        return;
                    }

                    node.querySelectorAll("iframe").forEach(function (iframe) {
                        bindIframe(iframe);
                    });
                });
            });
        });

        observer.observe(rootDocument.body, {
            childList: true,
            subtree: true,
        });
    }

    function bindIframes(rootDocument) {
        rootDocument.querySelectorAll("iframe").forEach(function (iframe) {
            bindIframe(iframe);
        });
    }

    function bindIframe(iframe) {
        if (!iframe || iframe.__jpdfBound === true) {
            return;
        }

        iframe.__jpdfBound = true;

        var bootstrapIframe = function () {
            var iframeDocument = null;

            try {
                iframeDocument = iframe.contentDocument;
            } catch (err) {
                return;
            }

            if (!iframeDocument) {
                return;
            }

            startBootstrap(iframeDocument);
        };

        iframe.addEventListener("load", bootstrapIframe);
        bootstrapIframe();
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

        var config = getConfig();
        if (!config.pdfjsUrl || !config.workerUrl) {
            return Promise.reject(new Error("jpdfViewerConfig is missing."));
        }

        var moduleUrl;
        var workerUrl;

        try {
            moduleUrl = resolveModuleUrl(config.pdfjsUrl, config);
            workerUrl = resolveModuleUrl(config.workerUrl, config);
        } catch (err) {
            return Promise.reject(err);
        }

        pdfjsPromise = import(moduleUrl).then(function (pdfModule) {
            var pdfjsLib = pdfModule && pdfModule.getDocument ? pdfModule : pdfModule.default;
            if (!pdfjsLib || !pdfjsLib.getDocument) {
                throw new Error("Unable to initialize PDF.js library.");
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
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

        var pdfUrlRaw = obj.getAttribute("data");
        if (!pdfUrlRaw) {
            return;
        }

        if (!obj.parentNode) {
            return;
        }

        var nodeDocument = obj.ownerDocument || document;

        var pdfUrl = resolvePdfUrl(pdfUrlRaw, getConfig());
        if (!pdfUrl) {
            console.warn("[jPlugin-PDFViewer] Skip unsafe PDF URL:", pdfUrlRaw);
            obj.setAttribute(PROCESSED_ATTR, "1");
            return;
        }

        obj.setAttribute(PROCESSED_ATTR, "1");

        // สร้าง container
        var container = nodeDocument.createElement("div");
        container.className = "jpdf-viewer-container";

        // Toolbar (ไม่มีปุ่ม download)
        var toolbar = nodeDocument.createElement("div");
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
        var canvasWrapper = nodeDocument.createElement("div");
        canvasWrapper.className = "jpdf-canvas-wrapper";
        var canvas = nodeDocument.createElement("canvas");
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

    function getConfig() {
        var config = window.__JPDF_VIEWER_CONFIG__ || window.jpdfViewerConfig || {};
        if (!config || typeof config !== "object") {
            return {};
        }

        return config;
    }

    function getSiteOrigin(config) {
        var fallbackOrigin = window.location.origin;
        var siteOrigin = config && typeof config.siteOrigin === "string" ? config.siteOrigin : "";
        if (!siteOrigin) {
            return fallbackOrigin;
        }

        try {
            return new URL(siteOrigin, window.location.href).origin;
        } catch (err) {
            return fallbackOrigin;
        }
    }

    function toUrl(rawUrl) {
        try {
            return new URL(rawUrl, window.location.href);
        } catch (err) {
            return null;
        }
    }

    function isHttpProtocol(protocol) {
        return protocol === "http:" || protocol === "https:";
    }

    function resolveModuleUrl(rawUrl, config) {
        var moduleUrl = toUrl(rawUrl);
        if (!moduleUrl) {
            throw new Error("Invalid PDF.js URL.");
        }

        if (!isHttpProtocol(moduleUrl.protocol)) {
            throw new Error("PDF.js URL must use HTTP/HTTPS.");
        }

        if (moduleUrl.origin !== getSiteOrigin(config)) {
            throw new Error("Blocked cross-origin PDF.js URL.");
        }

        if (!/\.m?js$/i.test(moduleUrl.pathname)) {
            throw new Error("PDF.js URL must be a JavaScript module file.");
        }

        return moduleUrl.href;
    }

    function resolvePdfUrl(rawUrl, config) {
        var pdfUrl = toUrl(rawUrl);
        if (!pdfUrl) {
            return null;
        }

        if (!isHttpProtocol(pdfUrl.protocol)) {
            return null;
        }

        var allowExternalPdf = config && config.allowExternalPdf === true;
        if (!allowExternalPdf && pdfUrl.origin !== getSiteOrigin(config)) {
            return null;
        }

        return pdfUrl.href;
    }
})();
