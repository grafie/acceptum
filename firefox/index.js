var sdkButtons = require('sdk/ui/button/action');
var sdkConfig = require('sdk/simple-prefs');
var sdkPanel = require("sdk/panel");
var sdkPath = require('sdk/fs/path');
var sdkTabs = require("sdk/tabs");

var nmMoment = require('moment');
var nmSlugifyURL = require('slugify-url');

const { MenuButton } = require('./lib/menu-button');

var utils = require('utils.js');

var panel = sdkPanel.Panel({
    contentURL: "./panel-menu.html",
    contentScriptFile: './panel-menu.js',
    onHide: function() {
        btn.state(
            'window',
            {
                checked: false
            }
        );
    }
});

panel.port.on('decrypt', function() {
    utils.pickPageCapture();
});

var btn = MenuButton({
    id: 'my-menu-button',
    label: 'My menu-button',
    icon: {
        "16": "./icon-16.png",
        "32": "./icon-32.png",
        "64": "./icon-64.png"
    },
    onClick: function click(state, isMenu) {

        if (isMenu) {
            panel.show(
                {
                    position: btn
                }
            );
        } else {
            doPageCapture();
        }
    }
});

function doPageCapture() {
    var defaultDirectoryPath = sdkConfig.prefs['pageCaptureSaveDirectory'];

    if (defaultDirectoryPath === undefined) {
        defaultDirectoryPath = utils.directoryPicker("Select the default directory for page captures");

        if (defaultDirectoryPath === null) {
            defaultDirectoryPath = utils.getDesktopPath('acceptum');
        }
        sdkConfig.prefs['pageCaptureSaveDirectory'] = defaultDirectoryPath;
    }

    var worker = sdkTabs.activeTab.attach({
        contentScriptFile: './wrapper.js'
    });

    worker.port.emit('getHeight');
    
    worker.port.on('height', function(height) {
        var canvas = utils.captureActiveTab(height);

        var filename = nmSlugifyURL(
            sdkTabs.activeTab.url,
            {
                unixOnly: true
            }
        ) + '.png' + ((sdkConfig.prefs['encryptPageCapture']) ? '.enc' : '');

        var today = nmMoment().format('YYYY' + sdkPath.sep + 'MM' + sdkPath.sep + 'DD');
        var path = defaultDirectoryPath + sdkPath.sep + today + sdkPath.sep;

        utils.saveCanvas(canvas, path, filename, 'secret', 16, 16);
    });

}