(function() {

  if (window.acceptumCSInjected) {
    return;
  }
  window.acceptumCSInjected = true;

  function getWindowAsCanvasDataURL() {
    let w = window.outerWidth;
    let h = window.outerHeight;
    let x = 0;
    let y = 0;

    let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

    canvas.width = w;
    canvas.height = h;

    let ctx = canvas.getContext('2d');

    ctx.clearRect(x, y, w, h);
    ctx.save();
    ctx.drawWindow(window, x, y, w, h, "rgb(255,255,255)");
    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  browser.runtime.onMessage.addListener((message) => {
    browser.runtime.sendMessage({"data": getWindowAsCanvasDataURL(), "command": message.command});
  });
})();
