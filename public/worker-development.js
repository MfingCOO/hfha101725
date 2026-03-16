/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./worker/index.ts":
/*!*************************!*\
  !*** ./worker/index.ts ***!
  \*************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval(__webpack_require__.ts("importScripts('/firebase-config.js');\nimportScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');\nimportScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');\nif (firebaseConfig) {\n    firebase.initializeApp(firebaseConfig);\n    const messaging = firebase.messaging();\n    messaging.onBackgroundMessage((payload)=>{\n        console.log('[Service Worker] Firebase background message (deprecated): ', payload);\n    });\n}\nself.addEventListener('push', function(event) {\n    console.log('[Service Worker] Push Received.');\n    if (!event.data) {\n        console.warn('[Service Worker] Push event contained no data.');\n        return;\n    }\n    try {\n        var _payload_data, _payload_notification, _payload_data1, _payload_notification1, _payload_data2, _payload_data3, _payload_data4, _payload_notification2;\n        const payload = event.data.json();\n        console.log('[Service Worker] Push payload: ', payload);\n        const notificationTitle = ((_payload_data = payload.data) === null || _payload_data === void 0 ? void 0 : _payload_data.title) || ((_payload_notification = payload.notification) === null || _payload_notification === void 0 ? void 0 : _payload_notification.title) || 'New Notification';\n        // Construct notification options from the richer data payload\n        const notificationOptions = {\n            body: ((_payload_data1 = payload.data) === null || _payload_data1 === void 0 ? void 0 : _payload_data1.body) || ((_payload_notification1 = payload.notification) === null || _payload_notification1 === void 0 ? void 0 : _payload_notification1.body),\n            icon: ((_payload_data2 = payload.data) === null || _payload_data2 === void 0 ? void 0 : _payload_data2.icon) || '/icon-192x192.png',\n            badge: ((_payload_data3 = payload.data) === null || _payload_data3 === void 0 ? void 0 : _payload_data3.badge) || '/icon-192x192.png',\n            image: ((_payload_data4 = payload.data) === null || _payload_data4 === void 0 ? void 0 : _payload_data4.image) || ((_payload_notification2 = payload.notification) === null || _payload_notification2 === void 0 ? void 0 : _payload_notification2.image),\n            data: payload.data\n        };\n        const notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions);\n        event.waitUntil(notificationPromise);\n    } catch (e) {\n        console.error('[Service Worker] Error processing push event:', e);\n    }\n});\nself.addEventListener('notificationclick', (event)=>{\n    const notification = event.notification;\n    const data = notification.data;\n    notification.close();\n    console.log('[Service Worker] Notification click received.', data);\n    // --- THIS IS THE CRITICAL FIX ---\n    // Prioritize the `url` field sent from our server.\n    const urlToOpen = data === null || data === void 0 ? void 0 : data.url;\n    if (!urlToOpen) {\n        console.error('[Service Worker] No URL found in notification data. Cannot open window.');\n        return;\n    }\n    console.log(\"[Service Worker] Attempting to open or focus URL: \".concat(urlToOpen));\n    event.waitUntil(self.clients.matchAll({\n        type: 'window',\n        includeUncontrolled: true\n    }).then((clientList)=>{\n        // Check if a window with the app's origin is already open.\n        for (const client of clientList){\n            // Use new URL() to easily compare origins, ignoring paths.\n            const clientUrl = new URL(client.url);\n            if (clientUrl.origin === self.location.origin && 'focus' in client) {\n                console.log('[Service Worker] App window is already open. Posting message and focusing.');\n                // If the app is open, we don't navigate. We post a message so the in-app\n                // NotificationActionHandler can decide what to do (e.g., smoothly navigate).\n                client.postMessage({\n                    type: 'notification_clicked',\n                    data: data\n                });\n                return client.focus();\n            }\n        }\n        // If the app is not open, open a new window to the specified URL.\n        if (self.clients.openWindow) {\n            console.log('[Service Worker] App not open. Opening new window.');\n            return self.clients.openWindow(urlToOpen);\n        }\n    }));\n});\nself.addEventListener('install', (event)=>{\n    console.log('[Service Worker] Install');\n    self.skipWaiting(); // Force the new service worker to activate immediately\n});\nself.addEventListener('activate', (event)=>{\n    console.log('[Service Worker] Activate');\n    event.waitUntil(self.clients.claim()); // Take control of all open pages\n});\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                /* unsupported import.meta.webpackHot */ undefined.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QXlFO2dCQUN6RSw2RUFBNkU7Z0JBQzdFOEIsT0FBT0ssV0FBVyxDQUFDO29CQUFFVCxNQUFNO29CQUF3QnRCLE1BQU1BO2dCQUFLO2dCQUM5RCxPQUFPMEIsT0FBT00sS0FBSztZQUNyQjtRQUNGO1FBRUEsa0VBQWtFO1FBQ2xFLElBQUksS0FBOENaLE9BQU8sQ0FBQ2EsVUFBVSxFQUFFO1lBQ3BFdEMsUUFBUUMsR0FBRyxDQUFDO1lBQ1osT0FBTyxLQUE4Q3dCLE9BQU8sQ0FBQ2EsVUFBVSxDQUFDZjtRQUMxRTtJQUNGO0FBRUo7QUFFQXJCLEtBQUtDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQ0M7SUFDaENKLFFBQVFDLEdBQUcsQ0FBQztJQUNYQyxLQUF3QnFDLFdBQVcsSUFBSSx1REFBdUQ7QUFDakc7QUFFQXJDLEtBQUtDLGdCQUFnQixDQUFDLFlBQVksQ0FBQ0M7SUFDakNKLFFBQVFDLEdBQUcsQ0FBQztJQUNaRyxNQUFNZSxTQUFTLENBQUMsS0FBeUJNLE9BQU8sQ0FBQ2UsS0FBSyxLQUFLLGlDQUFpQztBQUM5RiIsInNvdXJjZXMiOlsiL2hvbWUvdXNlci8xMDMxMjUvd29ya2VyL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImRlY2xhcmUgY29uc3QgZmlyZWJhc2U6IGFueTtcbmRlY2xhcmUgY29uc3QgZmlyZWJhc2VDb25maWc6IGFueTtcblxuaW1wb3J0U2NyaXB0cygnL2ZpcmViYXNlLWNvbmZpZy5qcycpO1xuaW1wb3J0U2NyaXB0cygnaHR0cHM6Ly93d3cuZ3N0YXRpYy5jb20vZmlyZWJhc2Vqcy85LjIzLjAvZmlyZWJhc2UtYXBwLWNvbXBhdC5qcycpO1xuaW1wb3J0U2NyaXB0cygnaHR0cHM6Ly93d3cuZ3N0YXRpYy5jb20vZmlyZWJhc2Vqcy85LjIzLjAvZmlyZWJhc2UtbWVzc2FnaW5nLWNvbXBhdC5qcycpO1xuXG5pZiAoZmlyZWJhc2VDb25maWcpIHtcbiAgZmlyZWJhc2UuaW5pdGlhbGl6ZUFwcChmaXJlYmFzZUNvbmZpZyk7XG4gIGNvbnN0IG1lc3NhZ2luZyA9IGZpcmViYXNlLm1lc3NhZ2luZygpO1xuXG4gIG1lc3NhZ2luZy5vbkJhY2tncm91bmRNZXNzYWdlKChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW1NlcnZpY2UgV29ya2VyXSBGaXJlYmFzZSBiYWNrZ3JvdW5kIG1lc3NhZ2UgKGRlcHJlY2F0ZWQpOiAnLCBwYXlsb2FkKTtcbiAgfSk7XG59XG5cbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcigncHVzaCcsIGZ1bmN0aW9uKGV2ZW50OiBhbnkpIHtcbiAgY29uc29sZS5sb2coJ1tTZXJ2aWNlIFdvcmtlcl0gUHVzaCBSZWNlaXZlZC4nKTtcbiAgaWYgKCFldmVudC5kYXRhKSB7XG4gICAgY29uc29sZS53YXJuKCdbU2VydmljZSBXb3JrZXJdIFB1c2ggZXZlbnQgY29udGFpbmVkIG5vIGRhdGEuJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkID0gZXZlbnQuZGF0YS5qc29uKCk7XG4gICAgY29uc29sZS5sb2coJ1tTZXJ2aWNlIFdvcmtlcl0gUHVzaCBwYXlsb2FkOiAnLCBwYXlsb2FkKTtcblxuICAgIGNvbnN0IG5vdGlmaWNhdGlvblRpdGxlID0gcGF5bG9hZC5kYXRhPy50aXRsZSB8fCBwYXlsb2FkLm5vdGlmaWNhdGlvbj8udGl0bGUgfHwgJ05ldyBOb3RpZmljYXRpb24nO1xuICAgIFxuICAgIC8vIENvbnN0cnVjdCBub3RpZmljYXRpb24gb3B0aW9ucyBmcm9tIHRoZSByaWNoZXIgZGF0YSBwYXlsb2FkXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uT3B0aW9ucyA9IHtcbiAgICAgIGJvZHk6IHBheWxvYWQuZGF0YT8uYm9keSB8fCBwYXlsb2FkLm5vdGlmaWNhdGlvbj8uYm9keSxcbiAgICAgIGljb246IHBheWxvYWQuZGF0YT8uaWNvbiB8fCAnL2ljb24tMTkyeDE5Mi5wbmcnLCAvLyBEZWZhdWx0IGljb25cbiAgICAgIGJhZGdlOiBwYXlsb2FkLmRhdGE/LmJhZGdlIHx8ICcvaWNvbi0xOTJ4MTkyLnBuZycsIC8vIFNvbHZlcyB0aGUgYmFkZ2UgNDA0IGlzc3VlXG4gICAgICBpbWFnZTogcGF5bG9hZC5kYXRhPy5pbWFnZSB8fCBwYXlsb2FkLm5vdGlmaWNhdGlvbj8uaW1hZ2UsXG4gICAgICBkYXRhOiBwYXlsb2FkLmRhdGEsIC8vIENydWNpYWw6IFBhc3MgYWxsIGRhdGEgdG8gdGhlIGNsaWNrIGhhbmRsZXJcbiAgICB9O1xuXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uUHJvbWlzZSA9IChzZWxmIGFzIHVua25vd24gYXMgU2VydmljZVdvcmtlckdsb2JhbFNjb3BlKS5yZWdpc3RyYXRpb24uc2hvd05vdGlmaWNhdGlvbihub3RpZmljYXRpb25UaXRsZSwgbm90aWZpY2F0aW9uT3B0aW9ucyk7XG4gICAgZXZlbnQud2FpdFVudGlsKG5vdGlmaWNhdGlvblByb21pc2UpO1xuXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbU2VydmljZSBXb3JrZXJdIEVycm9yIHByb2Nlc3NpbmcgcHVzaCBldmVudDonLCBlKTtcbiAgfVxufSk7XG5cbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbm90aWZpY2F0aW9uY2xpY2snLCAoZXZlbnQ6IGFueSkgPT4ge1xuICBjb25zdCBub3RpZmljYXRpb24gPSBldmVudC5ub3RpZmljYXRpb247XG4gIGNvbnN0IGRhdGEgPSBub3RpZmljYXRpb24uZGF0YTtcbiAgbm90aWZpY2F0aW9uLmNsb3NlKCk7XG5cbiAgY29uc29sZS5sb2coJ1tTZXJ2aWNlIFdvcmtlcl0gTm90aWZpY2F0aW9uIGNsaWNrIHJlY2VpdmVkLicsIGRhdGEpO1xuXG4gIC8vIC0tLSBUSElTIElTIFRIRSBDUklUSUNBTCBGSVggLS0tXG4gIC8vIFByaW9yaXRpemUgdGhlIGB1cmxgIGZpZWxkIHNlbnQgZnJvbSBvdXIgc2VydmVyLlxuICBjb25zdCB1cmxUb09wZW4gPSBkYXRhPy51cmw7XG5cbiAgaWYgKCF1cmxUb09wZW4pIHtcbiAgICBjb25zb2xlLmVycm9yKCdbU2VydmljZSBXb3JrZXJdIE5vIFVSTCBmb3VuZCBpbiBub3RpZmljYXRpb24gZGF0YS4gQ2Fubm90IG9wZW4gd2luZG93LicpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnNvbGUubG9nKGBbU2VydmljZSBXb3JrZXJdIEF0dGVtcHRpbmcgdG8gb3BlbiBvciBmb2N1cyBVUkw6ICR7dXJsVG9PcGVufWApO1xuXG4gIGV2ZW50LndhaXRVbnRpbChcbiAgICAoc2VsZiBhcyB1bmtub3duIGFzIFNlcnZpY2VXb3JrZXJHbG9iYWxTY29wZSkuY2xpZW50cy5tYXRjaEFsbCh7IHR5cGU6ICd3aW5kb3cnLCBpbmNsdWRlVW5jb250cm9sbGVkOiB0cnVlIH0pLnRoZW4oKGNsaWVudExpc3Q6IHJlYWRvbmx5IGFueVtdKSA9PiB7XG4gICAgICAvLyBDaGVjayBpZiBhIHdpbmRvdyB3aXRoIHRoZSBhcHAncyBvcmlnaW4gaXMgYWxyZWFkeSBvcGVuLlxuICAgICAgZm9yIChjb25zdCBjbGllbnQgb2YgY2xpZW50TGlzdCkge1xuICAgICAgICAvLyBVc2UgbmV3IFVSTCgpIHRvIGVhc2lseSBjb21wYXJlIG9yaWdpbnMsIGlnbm9yaW5nIHBhdGhzLlxuICAgICAgICBjb25zdCBjbGllbnRVcmwgPSBuZXcgVVJMKGNsaWVudC51cmwpO1xuICAgICAgICBpZiAoY2xpZW50VXJsLm9yaWdpbiA9PT0gc2VsZi5sb2NhdGlvbi5vcmlnaW4gJiYgJ2ZvY3VzJyBpbiBjbGllbnQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnW1NlcnZpY2UgV29ya2VyXSBBcHAgd2luZG93IGlzIGFscmVhZHkgb3Blbi4gUG9zdGluZyBtZXNzYWdlIGFuZCBmb2N1c2luZy4nKTtcbiAgICAgICAgICAvLyBJZiB0aGUgYXBwIGlzIG9wZW4sIHdlIGRvbid0IG5hdmlnYXRlLiBXZSBwb3N0IGEgbWVzc2FnZSBzbyB0aGUgaW4tYXBwXG4gICAgICAgICAgLy8gTm90aWZpY2F0aW9uQWN0aW9uSGFuZGxlciBjYW4gZGVjaWRlIHdoYXQgdG8gZG8gKGUuZy4sIHNtb290aGx5IG5hdmlnYXRlKS5cbiAgICAgICAgICBjbGllbnQucG9zdE1lc3NhZ2UoeyB0eXBlOiAnbm90aWZpY2F0aW9uX2NsaWNrZWQnLCBkYXRhOiBkYXRhIH0pO1xuICAgICAgICAgIHJldHVybiBjbGllbnQuZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBJZiB0aGUgYXBwIGlzIG5vdCBvcGVuLCBvcGVuIGEgbmV3IHdpbmRvdyB0byB0aGUgc3BlY2lmaWVkIFVSTC5cbiAgICAgIGlmICgoc2VsZiBhcyB1bmtub3duIGFzIFNlcnZpY2VXb3JrZXJHbG9iYWxTY29wZSkuY2xpZW50cy5vcGVuV2luZG93KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbU2VydmljZSBXb3JrZXJdIEFwcCBub3Qgb3Blbi4gT3BlbmluZyBuZXcgd2luZG93LicpO1xuICAgICAgICByZXR1cm4gKHNlbGYgYXMgdW5rbm93biBhcyBTZXJ2aWNlV29ya2VyR2xvYmFsU2NvcGUpLmNsaWVudHMub3BlbldpbmRvdyh1cmxUb09wZW4pO1xuICAgICAgfVxuICAgIH0pXG4gICk7XG59KTtcblxuc2VsZi5hZGRFdmVudExpc3RlbmVyKCdpbnN0YWxsJywgKGV2ZW50OiBhbnkpID0+IHtcbiAgY29uc29sZS5sb2coJ1tTZXJ2aWNlIFdvcmtlcl0gSW5zdGFsbCcpO1xuICAoc2VsZiBhcyB1bmtub3duIGFzIGFueSkuc2tpcFdhaXRpbmcoKTsgLy8gRm9yY2UgdGhlIG5ldyBzZXJ2aWNlIHdvcmtlciB0byBhY3RpdmF0ZSBpbW1lZGlhdGVseVxufSk7XG5cbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcignYWN0aXZhdGUnLCAoZXZlbnQ6IGFueSkgPT4ge1xuICBjb25zb2xlLmxvZygnW1NlcnZpY2UgV29ya2VyXSBBY3RpdmF0ZScpO1xuICBldmVudC53YWl0VW50aWwoKHNlbGYgYXMgdW5rbm93biBhcyBhbnkpLmNsaWVudHMuY2xhaW0oKSk7IC8vIFRha2UgY29udHJvbCBvZiBhbGwgb3BlbiBwYWdlc1xufSk7XG4iXSwibmFtZXMiOlsiaW1wb3J0U2NyaXB0cyIsImZpcmViYXNlQ29uZmlnIiwiZmlyZWJhc2UiLCJpbml0aWFsaXplQXBwIiwibWVzc2FnaW5nIiwib25CYWNrZ3JvdW5kTWVzc2FnZSIsInBheWxvYWQiLCJjb25zb2xlIiwibG9nIiwic2VsZiIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsImRhdGEiLCJ3YXJuIiwianNvbiIsIm5vdGlmaWNhdGlvblRpdGxlIiwidGl0bGUiLCJub3RpZmljYXRpb24iLCJub3RpZmljYXRpb25PcHRpb25zIiwiYm9keSIsImljb24iLCJiYWRnZSIsImltYWdlIiwibm90aWZpY2F0aW9uUHJvbWlzZSIsInJlZ2lzdHJhdGlvbiIsInNob3dOb3RpZmljYXRpb24iLCJ3YWl0VW50aWwiLCJlIiwiZXJyb3IiLCJjbG9zZSIsInVybFRvT3BlbiIsInVybCIsImNsaWVudHMiLCJtYXRjaEFsbCIsInR5cGUiLCJpbmNsdWRlVW5jb250cm9sbGVkIiwidGhlbiIsImNsaWVudExpc3QiLCJjbGllbnQiLCJjbGllbnRVcmwiLCJVUkwiLCJvcmlnaW4iLCJsb2NhdGlvbiIsInBvc3RNZXNzYWdlIiwiZm9jdXMiLCJvcGVuV2luZG93Iiwic2tpcFdhaXRpbmciLCJjbGFpbSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./worker/index.ts\n"));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			if (cachedModule.error !== undefined) throw cachedModule.error;
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/trusted types policy */
/******/ 	(() => {
/******/ 		var policy;
/******/ 		__webpack_require__.tt = () => {
/******/ 			// Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
/******/ 			if (policy === undefined) {
/******/ 				policy = {
/******/ 					createScript: (script) => (script)
/******/ 				};
/******/ 				if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
/******/ 					policy = trustedTypes.createPolicy("nextjs#bundler", policy);
/******/ 				}
/******/ 			}
/******/ 			return policy;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script */
/******/ 	(() => {
/******/ 		__webpack_require__.ts = (script) => (__webpack_require__.tt().createScript(script));
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/react refresh */
/******/ 	(() => {
/******/ 		if (__webpack_require__.i) {
/******/ 		__webpack_require__.i.push((options) => {
/******/ 			const originalFactory = options.factory;
/******/ 			options.factory = (moduleObject, moduleExports, webpackRequire) => {
/******/ 				const hasRefresh = typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
/******/ 				const cleanup = hasRefresh ? self.$RefreshInterceptModuleExecution$(moduleObject.id) : () => {};
/******/ 				try {
/******/ 					originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
/******/ 				} finally {
/******/ 					cleanup();
/******/ 				}
/******/ 			}
/******/ 		})
/******/ 		}
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	
/******/ 	// noop fns to prevent runtime errors during initialization
/******/ 	if (typeof self !== "undefined") {
/******/ 		self.$RefreshReg$ = function () {};
/******/ 		self.$RefreshSig$ = function () {
/******/ 			return function (type) {
/******/ 				return type;
/******/ 			};
/******/ 		};
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval-source-map devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./worker/index.ts");
/******/ 	
/******/ })()
;