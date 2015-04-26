var app = require('http').createServer(handler)
  , io  = require('socket.io').listen(app)
  , fs  = require('fs')

var cmds = [];

app.listen(80);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

function registerCmd(cmd, handler) {
  cmds.push({cmd: cmd, handler: handler});
  console.log(cmds);
}

function handleCmd(socket, cmd, args) {
  var handled = false;

  for (var i = 0; i < cmds.length; i++) {
    if (cmds[i].cmd.toLowerCase() == cmd.toLowerCase()) {
      cmds[i].handler(socket, args);
      handled = true;
    }
  }

  return handled;
}

function getUserNick(socket) {
  var nick = null;
  socket.get('nick', function(err, val) {nick = val});
  return (nick != null ? nick : socket.handshake.address.address);
}

io.sockets.on('connection', function (socket) {
  socket.emit('message', { text: 'Welcome to NodeChat, ' + socket.handshake.address.address + '\r\n\r\n' +
    'Available commands\r\n' +
    '------------------\r\n' +
    '/nick <name> - change your chat nickname\r\n',
    type: 'info'
  });

    console.log(io.sockets);

  socket.on('message', function (message, callback) {
    console.log(message);

    if (message.text.substring(0, 1) == '/') {
      var cmd = message.text.substring(1);
      var args = null;

      if (message.text.indexOf(' ') != -1) {
        cmd = cmd.substring(0, cmd.indexOf(' '));
        args = message.text.substring(message.text.indexOf(' ') + 1).split(' ');
      } 

      if (!handleCmd(socket, cmd, args)) {
        socket.emit('message', { text: 'Command "' + cmd + '" does not exist.', type: 'info' })
      }
    }
    else {
      var wrappedMessage = JSON.parse(JSON.stringify(message));
      wrappedMessage.user = getUserNick(socket)
      io.sockets.emit('message', wrappedMessage);
    }
  });
});

registerCmd(
  'nick', function(socket, args) {
    socket.set('nick', args[0]);
    socket.emit('message', { text: 'You are now known as "' + args[0] + '".', type: 'info' });
  }
);
registerCmd(
  'whisper', function(socket, args) {
    var rcpSocket = null;

    for (s in io.sockets) {
      if (getUserNick(s.manager) == args[0]) {
        rcpSocket = s;
      }
    }

    if (rcpSocket == null) {
      socket.emit('message', { text: 'Whisper recipient not found.', type: 'info' })
    }
    else {
      rcpSocket.emit('message', { text: args[1], type: 'whisper', user: getUserNick(rcpSocket) });
    }
  }
);