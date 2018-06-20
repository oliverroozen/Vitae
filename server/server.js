"use strict";
console.log('Server initializing...');

const express = require('express');
const responseTime = require('response-time');
const mysql = require('mysql');
const WebSocket = require('ws');
const http = require('http');
const uuidv4 = require('uuid/v4');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer();

const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

const wss = new WebSocket.Server({
  verifyClient: (info, done) => {
    console.log('Parsing session from request...');
    sessionParser(info.req, {}, () => {
      console.log('Session is parsed!');
      // We can reject the connection by returning false to done(). For example, reject here if user is unknown.
      done(info.req.session.userId);
    });
  },server});

var sql = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    dateStrings: true, // Note, when mysql date fields are returned, they are auto-converted by Node from objects into strings using the wrong date function. This converts them before this.
    multipleStatements: true
});

var websocketUsers = {}; // Depreciated

server.on('request', app);

app.set('title', 'Revision Manager');
app.set('views', 'site/views');
app.set('view engine', 'pug');

app.use(express.static('site/static'));
app.use(responseTime({digits:0, suffix:false}));
app.use(bodyParser.json());
app.use(sessionParser);

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
                username VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                sessionID VARCHAR(36),
                sessionCreation DATETIME,
				accountType CHAR(4) NOT NULL,
				schoolID SMALLINT NOT NULL,
				nzqaNum INT NOT NULL,
				fullName VARCHAR(64) NOT NULL,
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

app.post('/validate', function (req, res) {
    console.log(req.body);
    
    sql.query('SELECT userID FROM users WHERE username = ? AND password = ?', [req.body.username,req.body.password],(error,results,fields)=>{
        if (error) throw error;

        if (results.length == 0) {
            // Send response to let client know server handled successfully, but with no returns
            console.log('Details are invalid.');
            res.json({result:'FAIL',message:'Details are invalid.'});
        } else {
            var newSessionID = uuidv4();
            sql.query('UPDATE users SET sessionID = ?, sessionCreation = CURRENT_TIMESTAMP()', [newSessionID],(error,results,fields)=>{
                if (error) throw error;
            });
            req.session.userId = newSessionID;
            res.json({result:'OK',message:'Session updated.'});
        }
    });
});

wss.on('connection', (ws, req) => {
    console.log('Websocket connection made!');
    
    req.session.userId = uuidv4(); // New session code.
    
//    ws.isAlive = true;
//    ws.on('pong', heartbeat);
    
    ws.on('message', (message) => {
        console.log(`WS message: ${message}`);
        var data = JSON.parse(message);
        
        switch (data.process) {
            case 'signin':
                console.log("Submitted info: " + data.user);

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

//const keepalive = setInterval(function ping() {
//    for (var key in websocketUsers) {
//        if (websocketUsers.hasOwnProperty(key)) {
//            websocketUsers[key].forEach((ws,idx)=>{
//                if (ws.isAlive === false) {
//                    websocketUsers[key].splice(idx, 1);
//                    console.log('Terminating WS for user ' + key);
//                    console.log(websocketUsers[key].length + ' websockets connected');
//                    return;
////                    return ws.terminate();
//                }
//                ws.isAlive = false;
//                ws.ping('', false, true);
//            });
//        }
//    }
//}, 5000);

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

`CREATE TABLE IF NOT EXISTS users (
				userID INT NOT NULL AUTO_INCREMENT,
                username VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                sessionID VARCHAR(36),
                sessionCreation DATETIME,
				accountType CHAR(4) NOT NULL,
				schoolID SMALLINT NOT NULL,
				nzqaNum INT NOT NULL,
				fullName VARCHAR(64) NOT NULL,
				yearLevel TINYINT NOT NULL,
				bio VARCHAR(256) NOT NULL,
				PRIMARY KEY (userID),
				FOREIGN KEY (schoolID) REFERENCES schools(schoolID)
			)`

`CREATE TABLE IF NOT EXISTS schools (
				schoolID SMALLINT NOT NULL AUTO_INCREMENT,
				nzqaNum SMALLINT NOT NULL,
				title VARCHAR(64) NOT NULL,
				location VARCHAR(255) NOT NULL,
				PRIMARY KEY (schoolID)
			)`

function insertTestUserData() {
    var user = {
        username: 'roozeno',
        password: 'admin1234',
        accountType: 'stdt',
        schoolID: 347,
        nzqaNum: 0126555266,
        fullName: 'Ollie Roozen',
        yearLevel: 13,
        bio: 'I am the creator.'
    };
    var school = {
        nzqaNum: 347,
        title: 'Lincoln High School',
        location: 'Lincoln, Christchurch'
    }
    sql.query('INSERT INTO schools VALUES (?,?,?)', [school.nzqaNum,school.title,school.location],(error,results,fields)=>{
        if (error) {throw error};
        
        sql.query('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)', [],(error,results,fields)=>{
        if (error) {throw error};
        
        });
    });
}

/*
ALTER USER 'root'@'localhost'
IDENTIFIED BY 'admin' PASSWORD EXPIRE NEVER;
*/