chrome.tabs.query({currentWindow: true, active: true}, function(tab) {
    chrome.pageCapture.saveAsMHTML({tabId: tab[0].id}, function(data) {
        // Save to file
    });
});
