var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var { viewFor } = require("sdk/view/core");
const { Cc, Ci, Cu } = require('chrome');
const { OS } = Cu.import("resource://gre/modules/osfile.jsm");
const { Task } = Cu.import("resource://gre/modules/Task.jsm");

var button = buttons.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

function handleClick(state) {

  var chromeWindow = viewFor(tabs.activeTab.window);
  console.log(tabs.activeTab.url, chromeWindow);
var canvas = chromeWindow.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
//console.log(canvas.toDataURL());
captureTab();
/*        var path = '/home/rhiza/test.png';
        var reader = new FileReader;
        var blob = yield new Promise(accept => canvas.toBlob(accept, 'image/png', 1));
        reader.readAsArrayBuffer(blob);

        new Promise(accept => { reader.onloadend = accept });

        OS.File.writeAtomic(path, new Uint8Array(reader.result),
                                         { tmpPath: path + '.tmp' });
*/
}

const { getTabContentWindow, getActiveTab } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

function captureTab(tab=getActiveTab(getMostRecentBrowserWindow())) {
  let contentWindow = getTabContentWindow(tab);
  let { document } = contentWindow;

  let w = contentWindow.innerWidth;
  let h = contentWindow.innerHeight;
  let x = contentWindow.scrollX;
  let y = contentWindow.scrollY;

  let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

  canvas.width = w;
  canvas.height = h;

  let ctx = canvas.getContext('2d');

  ctx.drawWindow(contentWindow, x, y, w, h, '#000');

  //let dataURL = canvas.toDataURL();
  saveCanvas(canvas, 'test.png');
  canvas = null;
}

function saveCanvas(canvas, name) {
    var path = OS.Path.join(OS.Constants.Path.desktopDir, name);
    return Task.spawn(function *() {
        var reader = Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader);
        var blob = yield new Promise(accept => canvas.toBlob(accept));
        reader.readAsArrayBuffer(blob);
        yield new Promise(accept => { reader.onloadend = accept });
        return yield OS.File.writeAtomic(path, new Uint8Array(reader.result));
    });
}

function expose(event) {
    Cu.exportFunction(saveCanvas, event.subject, {defineAs: "saveCanvas"});
}

exports.main = function(options, callbacks) {
    var events = require("sdk/system/events");
    events.on("content-document-global-created", expose);
};
