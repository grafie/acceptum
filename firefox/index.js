var sdkButtons = require('sdk/ui/button/action');
var sdkConfig = require('sdk/simple-prefs');
var sdkPanel = require("sdk/panel");
var sdkPath = require('sdk/fs/path');
var sdkTabs = require("sdk/tabs");

var nmMoment = require('moment');
var nmSlugifyURL = require('slugify-url');
var nm_ = require('lodash');

const { MenuButton } = require('./lib/menu-button');

var utils = require('utils.js');
var package = require('package.json');

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
    var worker = sdkTabs.activeTab.attach({
        contentScriptFile: './wrapper.js'
    });

    worker.port.emit('getPassword');
    worker.port.on('password', utils.pickPageCapture);
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

function getMimeType() { // find better way to get prefs?
    var options = nm_.find(package.preferences, {'name': 'pageCaptureImageType'}).options;
    var type = nm_.find(options, {'value': sdkConfig.prefs['pageCaptureImageType'].toString()});
    return type.label;
}

function doPageCapture() {
    var defaultDirectoryPath = sdkConfig.prefs['pageCaptureSaveDirectory'];
    var encryptPageCapture = sdkConfig.prefs['encryptPageCapture'];
    var mimeType = getMimeType();

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

        var filename = nmSlugifyURL(
            sdkTabs.activeTab.url,
            {
                unixOnly: true
            }
        ) + '.' + mimeType.split('/')[1] + ((encryptPageCapture) ? '.enc' : '');

        var today = nmMoment().format('YYYY-MM-DD').replace('-', sdkPath.sep);
        var path = defaultDirectoryPath + sdkPath.sep + today + sdkPath.sep;

        if (encryptPageCapture) {
            worker.port.emit('getPassword');

            worker.port.on('password', function(password) {
                utils.saveCanvas(utils.captureActiveTab(height), path, filename, mimeType, password, 16, 16);
            });
        } else {
            utils.saveCanvas(utils.captureActiveTab(height), path, filename, mimeType, null, 0, 0);
        }
    });
}