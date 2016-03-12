self.port.on("getHeight", function() {
    var body = document.body,
        html = document.documentElement;

    var height = Math.max( body.scrollHeight, body.offsetHeight, 
                           html.clientHeight, html.scrollHeight, html.offsetHeight );

    self.port.emit('height', height);
});

self.port.on("getPassword", function() {
    self.port.emit('password', window.prompt('Password for encrypting page capture?'));
});