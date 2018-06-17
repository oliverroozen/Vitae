"use strict";
console.log('Server initializing...');

const express = require('express');
const responseTime = require('response-time');
const mysql = require('mysql');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer();
const wss = new WebSocket.Server({server:server});

var sql = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    dateStrings: true, // Note, when mysql date fields are returned, they are auto-converted by Node from objects into strings using the wrong date function. This converts them before this.
    multipleStatements: true
});

var websocketUsers = {};

server.on('request', app);

app.set('title', 'Revision Manager');
app.set('views', 'site/views');
app.set('view engine', 'pug');

app.use(express.static('site/static'));
app.use(responseTime({digits:0, suffix:false}));

sql.connect((err)=>{
    if (err) {
        console.log('Error connecting to SQL database: ' + err.stack);
    } else {
        sql.query('CREATE DATABASE IF NOT EXISTS Vitae',(err)=>{
			sql.changeUser({database : 'Vitae'}, function(err) {if (err) throw err;});
			sql.query(`CREATE TABLE IF NOT EXISTS schools (
				schoolID SMALLINT NOT NULL AUTO_INCREMENT,
				nzqaNum SMALLINT NOT NULL,
				title VARCHAR(64) NOT NULL,
				location VARCHAR(255) NOT NULL,
				PRIMARY KEY (schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS users (
				userID INT NOT NULL AUTO_INCREMENT,
				accountType CHAR(4) NOT NULL,
				schoolID SMALLINT,
				nzqaNum INT NOT NULL,
				userCode VARCHAR(255) NOT NULL,
				name VARCHAR(64) NOT NULL,
				yearLevel TINYINT NOT NULL,
				bio VARCHAR(256) NOT NULL,
				PRIMARY KEY (userID),
				FOREIGN KEY (schoolID) REFERENCES schools(schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS posts (
				postID INT NOT NULL AUTO_INCREMENT,
				postType CHAR(4) NOT NULL,
				userID INT NOT NULL,
				postTime DATETIME DEFAULT CURRENT_TIMESTAMP(),
				privacyLevel TINYINT NOT NULL,
				youTubeURL VARCHAR(11) NOT NULL,
				PRIMARY KEY (postID),
				FOREIGN KEY (userID) REFERENCES users(userID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS comments (
				commentID INT NOT NULL AUTO_INCREMENT,
				postID INT NOT NULL,
				postTime DATETIME DEFAULT CURRENT_TIMESTAMP(),
				content VARCHAR(256) NOT NULL,
				PRIMARY KEY (commentID),
				FOREIGN KEY (postID) REFERENCES posts(postID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
//			sql.query(`CREATE TRIGGER setuuid
//				BEFORE INSERT ON assessments
//				FOR EACH ROW
//					IF new.assessmentID IS NULL
//					THEN
//						SET new.assessmentID = UUID_SHORT();
//				END IF;
//			`, (err)=>{
//				if (err) {
//					if (err.errno != 1359) {console.log(err)} else {console.log('Caught error on create trigger.')};
//				};
//			});

			console.log('Connected to database...');

			server.listen(2001,()=>{
				console.log('Online on port 2001!');
			});
		});
    }
});

app.get('/', function (req, res) {
    res.render('login', {randVer: Math.round(Math.random()*1000)});
    console.log(`index served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
});

wss.on('connection', (ws, req) => {
    console.log('Websocket connection made!');
    
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    ws.on('message', (message) => {
        console.log(`WS message: ${message}`);
        var data = JSON.parse(message);
        
//        console.log(JSON.stringify(websocketUsers));
        
        switch (data.process) {
            case 'signin':
                const id = data.user.id;
                console.log("Submitted ID: " + id);

                sql.query('SELECT userID FROM users WHERE userID = ?', [id], function (error, results, fields) {
                    if (error) throw error;

                    if (results.length == 0) {
                        // Send response to let client know server handled successfully, but with no returns
                        console.log('No account found.')
                        ws.send(JSON.stringify({callback:data.callback,user:false}));
                    } else {
                        // Login
                        console.log('ID recognized, serving data...');
                        sql.query('SELECT name, subject, format, type, start, end, time FROM assessments WHERE userID = ?', [id], function (error, results, fields) {
                            if (error) throw error;

                            console.log('Found user data.');
                            ws.send(JSON.stringify({callback:data.callback,user:{id:id, assessments:results}}));
                            recordWS(id,ws);
                        });
                        sql.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP(), lastIP = ? WHERE userID = ?', [ws._socket.remoteAddress + ws._socket.remotePort, id], function (error, results, fields) {
                            if (error) throw error;
                        });
                    }
                });
                break;
            default:
                console.log('Error in data.');
        }
    });
});

wss.on('close', (close) => {
    console.log('Websocket connection closed.');
//    console.log(JSON.stringify(req));
//    websocketUsers[data.user.id] = ws;
});

wss.on('error', (error) => {
    console.log('Websocket connection closed due to error.');
//    console.log(JSON.stringify(req));
//    websocketUsers[data.user.id] = ws;
});

const keepalive = setInterval(function ping() {
    for (var key in websocketUsers) {
        if (websocketUsers.hasOwnProperty(key)) {
            websocketUsers[key].forEach((ws,idx)=>{
                if (ws.isAlive === false) {
                    websocketUsers[key].splice(idx, 1);
                    console.log('Terminating WS for user ' + key);
                    console.log(websocketUsers[key].length + ' websockets connected');
                    return;
//                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping('', false, true);
            });
        }
    }
}, 5000);

function createUser(callback,ws,ip) {
    const newCode = generateCode(6);
    console.log(`Creating new account with ID '${newCode}'...`);
    sql.query('INSERT INTO users (userID, lastLogin, lastIP) VALUES (?,CURRENT_TIMESTAMP(),?)', [newCode,ip], function (error, results, fields) {
        if (error) {
            console.log('Error: ' + error);
            if (error.errno == 1062) {
                console.log('Rerolling for new code...');
                createUser(ws,ip);
            } else {
                throw error;
            }
        } else {
            ws.send(JSON.stringify({callback:callback,user:{id:newCode,assessments:[]}}));
            recordWS(newCode,ws);
        }
    });
}

function generateCode(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    
    return text;
}

function alertUsers(id, sender) {
    sql.query('SELECT name, subject, format, type, start, end, time FROM assessments WHERE userID = ?', [id], function (error, results, fields) {
        if (error) throw error;

        websocketUsers[id].forEach((val)=>{
            if (val.readyState === WebSocket.OPEN && sender !== val) {
                console.log('Alerting user of ID' + id);
                val.send(JSON.stringify({process:'reload',callback:null,user:{id:id,assessments:results}}));
            }
        });
    });
}

function heartbeat() {
    this.isAlive = true;
}

function recordWS(id, ws) {
    websocketUsers[id] = websocketUsers[id] || [];
    websocketUsers[id].push(ws);
    console.log('Adding new websocket, now at ' + websocketUsers[id].length);
}


/*
ALTER USER 'root'@'localhost'
IDENTIFIED BY 'admin' PASSWORD EXPIRE NEVER;
*/

// SELECT CASE WHEN EXISTS (SELECT NULL FROM users WHERE userID = ?) THEN 1 ELSE 0 END

//sql.query('SELECT ?? FROM ?? WHERE id = ?', [], function (error, results, fields) {
//    if (error) throw error;
//
//});

//var userData = {
//    code: "",
//    assessments: {
//        "":{
//            name: "",
//            subject: "",
//            format: "",
//            type: "",
//            start: "yyyy-mm-dd",
//            end: "yyyy-mm-dd",
//            time: "hh:mm"
//        }
//    }
//};

//ON DULPLICATE KEY UPDATE assessments VALUES ()