"use strict";

// Global constant declarations for general use across program
const callDate = new Date();
const host = "ws://" + window.location.host;

var serverSocket;
var connectionRetry;
var currentlyEditing = false;
var WScallbacks = [];
var userData = {};

//establishWebsocket();

// As soon as the DOM is ready to manipulate...
$(document).ready(()=>{
    console.log('Document ready!');
	
	// If enter button is hit on assessments screen
    $('body#login .container input').on('keyup',(event)=>{
        if (event.keyCode == 13) {
            attemptLogin();
        }
    });
    
    if (window.location.pathname == '/') {
        $('#header').css({top:'0px'});
    }
    
//    // Waiting until background image is ready to start slideshow...
//    if ($(background).prop('complete')) {
//        initBackground();
//    } else {
//        $(background).load(()=>{
//            initBackground();
//        });
//    }
    
//    // Ping the server to see if a logged user account is valid. If so, load and enter program.
//    if (Cookies.get('userID') != undefined) {
//        handleWS('signin', {id:Cookies.get('userID')}, (user)=>{
//            if (user == false) {
//                revisionDisplay.load('#exampleDisplay', [
//                    ["Science","Technology","Engineering","Arts","Mathematics"],
//                    [1,1,1,1,1]
//                ]);
//            } else {
//                console.log('%cWelcome back, student!','background: #222; color: rgb(5,255,255); font-size:1.5em; padding:3px;');
//                
//                revisionDisplay.load('#exampleDisplay', revisionDisplay.calcImportance(user.assessments));
//                loadMain();
//            }
//        });
//    } else {
//        revisionDisplay.load('#exampleDisplay', [
//            ["Science","Technology","Engineering","Arts","Mathematics"],
//            [1,1,1,1,1]
//        ]);
//    }
});

function attemptLogin() {
	// Submit code
	var submittedUsername = $('#username').val().trim();
	var submittedPassword = $('#password').val().trim();
	
	console.log('Attempting login...');
	
	if (submittedUsername.length > 0 && submittedPassword.length >= 8) {
        var dataInput = {"username":submittedUsername,"password":submittedPassword};
		// Potentially viable details
        $.ajax({
            url: '/validate',
            data: JSON.stringify(dataInput),
            dataType: 'JSON',
            contentType: "application/json",
            method: 'POST',
            timeout: 5000,
        }).done((data)=>{
            console.log(data);
			if (data.result == 'OK') {
				successfulLogin();
			} else {
				networkImageAnimation();
			}
        });
        
//		handleWS('signin', {username:submittedUsername,password:submittedPassword}, (session)=>{
//			if (session == false) {
//				$('#codeInput').css(failStyle);
//			} else {
//				revisionDisplay.update(revisionDisplay.calcImportance(user.assessments));
//
//				$('#codeInput').css(succStyle);
//				$('body#welcome .background img').css({filter:''});
//				setTimeout(()=>{
//					$('#accountManagement div.popup').fadeOut(300);
//				},500)
//				loadMain();
//			}
//		});
	} else {
        networkImageAnimation();
	}
}

function successfulLogin() {
	$("div#backgroundicon svg").addClass('iconExitAnim');
	$(".container .box").css({opacity:0});
	setTimeout(()=>{
		window.location.replace('../');
	},1500);
	
	return('Logged in.');
}

function networkImageAnimation(color) {
    var networkImage = Snap('#backgroundicon svg').select('*');
    Snap.animate([255,0,0],[80,10,30], function(values) {
        networkImage.attr({'stroke':`rgb(255,${values[0]},${values[0]})`,'stroke-dasharray': `20,${values[1]}`,'stroke-dashoffset':values[2]});
    }, 1000, mina.easein(), ()=>{
        Snap.animate([80,10,30],[255,0,45], function(values) {
            networkImage.attr({'stroke':`rgb(255,${values[0]},${values[0]})`,'stroke-dasharray': `20,${values[1]}`,'stroke-dashoffset':values[2]});
        },1000,mina.easeout());
    });
}
    
// Function that automatically positions the background based on the dimensions of the image and the viewport
function sizeBG() {
    const windowAspectRatio = $(window).width() / $(window).height();
    const backgroundAspectRatio = $(background).width() / $(background).height();
    
    if (windowAspectRatio < backgroundAspectRatio) {
        $(background).css({
            'height':`calc(100vh + ${(($(window).height()/2)/prlxCoef)*2}% + ${blurCoef}px)`,
            'width':'initial'
        });
    } else {
        $(background).css({
            'width':`calc(100vw + ${(($(window).width()/2)/prlxCoef)*2}% + ${blurCoef}px)`,
            'height':'initial'
        });
    }
}

// Creates throttled parallax function that fires max 30fps to cut down lag
var parralax = _.throttle((event) => { // event.pageX, event.pageY
    var xDiff = event.pageX - $(window).width()/2;
    var yDiff = event.pageY - $(window).height()/2;
    
    $("body#welcome .background img").css({
        'transform':`translate(${(xDiff/-prlxCoef)-50}%,${(yDiff/-prlxCoef)-50}%)`
    });
    $("body#welcome .intro > .wrapper").css({
        'transform':`translate(${(xDiff/(prlxCoef*8))-50}%,${(yDiff/(prlxCoef*8))-50}%)`
    });
},1000/30);

// Websocket code
function establishWebsocket() {
    serverSocket = new WebSocket(host);
    
    serverSocket.addEventListener('open', (event)=>{
        console.log('Websocket connection online.');
        $('#disconnectedOverlay').fadeOut(600);
    });
    serverSocket.addEventListener('close', (event)=>{
        console.log('Socket closed.');
        
        connectionRetry = setTimeout(()=>{
            establishWebsocket();
        },5000);
        
        $('#disconnectedOverlay').fadeIn(600);
    });
    serverSocket.addEventListener('error', (event)=>{
        console.error('Error connecting to websocket server!');
    });
    serverSocket.addEventListener('message', (event)=>{
        var data = JSON.parse(event.data);

        console.log(data);

        if (data.process == 'reload') {
            console.warn('Server alerted to changes, updating data.');
            updateUser(data.user, false);
            revisionDisplay.update(revisionDisplay.calcImportance(data.user.assessments));
        } else {
            if (data.user != false) {
                updateUser(data.user, false);
            }
            WScallbacks[data.callback](data.user);
            WScallbacks.splice(data.callback,1);
        }
    });
}

function handleWS(mode, data, callback) {
    var lastIndex = WScallbacks.push(callback) - 1;
    serverSocket.send(JSON.stringify({process:mode,callback:lastIndex,user:data}));
}

// Function from StackOverflow that resolves length of an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
}

// Function to format date in MMM-DD format for readibility
function formatDateUser(date) {
    if (date == '') {return};
        
    var dateOjb = new Date(date);
    return `${BGmonth[dateOjb.getMonth()][0].substr(0,3).toLowerCase().capFL()} ${dateOjb.getDate()}<i>${getOrdinal(dateOjb.getDate())}</i>`;
}

// Function from StackOverflow for finding the ordinal to a number
function getOrdinal(num) {
    var s = ["th","st","nd","rd"],
    v = num % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
}

// Function to convert 24h HH:MM time into 12h HH:MM AM/PM format
function displayTime12H(time) {
    // 12PM = 12 | 12AM = 0
    if (time == '') {return};
    
    var hourMin = (time).match(/(\d\d)/g);
    
    var mode;
    if (hourMin[0] >= 12) {
        mode = 'PM'; 
        hourMin[0] %= 12;
    } else {
        mode = 'AM';
    }
    
    if (hourMin[0] == 0) {
        hourMin[0] = 12;
    }
    
    return `${+hourMin[0]}:${hourMin[1]} <i>${mode}</i>`;
}

// Function to convert the raw assessment type into readable format
function displayAssessmentFormat(format) {
    var formats = {
        "prjt":"Project",
        "exam":"Exam",
        "prct":"Practical",
        "othr":"Other"
    }
    return formats[format];
}

// Function to convert the raw assessment type into readable format
function displayAssessmentType(type) {
    var types = {
        "prac":"Practice",
        "full":"Full"
    }
    return types[type];
}

// Checks to see if assessment is currently active, and should be displayed
function checkIfActive(startTime, endTime, crntTime) {
    if (startTime < crntTime && endTime > crntTime) {
        return true;
    } else {
        return false;
    }
}

// Appends function to string prototype for capatalizing first letter
String.prototype.capFL = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

// Appends function to number prototype for adding 0s to beginning of number
Number.prototype.pad = function(n) {
    return new Array(n).join('0').slice((n || 2) * -1) + this;
}

window.onbeforeunload = function() {
    serverSocket.onclose = function () {}; // disable onclose handler first
    serverSocket.close();
};

/*
// Main title 3D text animation
function titleEntrance() {
    var letters = $('#title .main span');
    var subContainer = $('#title .container');
    var letterQuantity = letters.length;
    var count = 0;
    var entryTime = 1500;
    
    var letterIterate = setInterval(function() {
        if (count <= letterQuantity) {
            letters.eq(count).addClass('letterSpin');
            count++;
        } else {
            clearTimeout(letterIterate);
            subContainer.css('opacity','1');
        }
    }, entryTime/letterQuantity); 
}
*/