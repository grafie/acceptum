var d = document.getElementById("decrypt");
d.addEventListener('click', function (event) {
    self.port.emit('decrypt');
}, false);
