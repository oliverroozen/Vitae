"use strict";

// Global constant declarations for general use across program
const host = "ws://" + window.location.host;
var preloadedImages = [];


// As soon as the DOM is ready to manipulate...
$(document).ready(()=>{
    console.log('Document ready!');
	
	// If enter button is hit on assessments screen
    $('body#login .container input').on('keyup',(event)=>{
        if (event.keyCode == 13) {
            attemptLogin();
        }
    });
    
    // Activates header and footer animations on the index page
    if (window.location.pathname == '/') {
		// Animate navigation entry
        $('#nav').css({top:'0px'});
        
		// Call to function that fetches individual posts
		fetchArticle(3,()=>{
            // Checks if the footer is in view, to fetch more articles
            inView('#footer').on('enter',()=>{
				// When footer in view, load X more articles...
                console.log('Reached bottom of page, loading more articles...');
                $('#footer .loading').css({opacity:1});
                footerLoad();
                fetchArticle(2);
            });
        });
    } else {
		$('#nav').css({top:'0px'});
	}
});

// Function that makes AJAX call to server to fetch X number of posts
function fetchArticle(quantity,callback) {
	// Feth variables from DOM
    const timeline = $('#content div.main');
    var fromID = timeline.find('.article').last().attr('postuuid');
    
    console.log(JSON.stringify({'fromID':fromID,'quantity':quantity}));
    
	// AJAX call to server
    $.ajax({
        url: '/article',
        data: JSON.stringify({'fromID':fromID,'quantity':quantity}),
        dataType: 'JSON',
        contentType: "application/json",
        method: 'POST',
        timeout: 5000,
    }).done((response)=>{
        console.log(JSON.stringify(response));
		
		// Check if server responded correctly, else display error
        if (response.result == 'OK') {
            // URL for preload, Append all, sequentially animate them in by ID/order
            console.log(JSON.stringify($.parseHTML(response.html)));
            
			// Concatenate the postUUIDs from the server's HTML response
            var postUUIDs = $($.parseHTML(response.html)).filter('.article').map((index, value)=>{
                return $(value).attr('postuuid');
            });
            
			// Map the post image URLs from the UUIDs
            var postURLs = postUUIDs.map((idx,val)=>{
                return `images/${val}.jpg`;
            });
            
            console.log(postURLs);
            
			// Call the preload function to make sure that the articles don't show until all images are downloaded
            preload(postURLs,()=>{
				// Find the last article in the timeline to iterate from
                var iteration = timeline.find('.article').length;
				
				
                console.log('All images loaded, inserting HTML...')
				
				// Append all the new HTML to the timeline
                timeline.append(response.html);
				// The callback traces all the way from the fetchArticle() request, slightly spaghetti I know
                if (callback) {callback()};
                
				// Interval to sequentially entry animate articles
                setInterval(()=>{
					if (iteration < timeline.find('.article').length) {
						timeline.find('.article').eq(iteration).css({opacity:1,top:'0px'});
					} else {
						clearInterval(this);
					}
                    iteration++;
                },30);
            });
        } else {
            console.log('The server has rejected the AJAX request.');
            
			// Clear footer to display a given error message
            $('#footer .loading').css({opacity:0});
            $('#footer .info').text(response.data);
            $('#footer .info').css({display:'initial',opacity:1});
        }
    });
}

function preload(urls,callback) {
    var loaded = 0;
    for (var i = 0; i < urls.length; i++) {
        var index = preloadedImages.push(new Image()) - 1;
        preloadedImages[index].src = urls[i];
        preloadedImages[index].onload = function() {
            loaded++;
            if (loaded == urls.length) {callback()};
        }
    }
}

function footerLoad() {
//	$('#footer').animate({gradient:'linear-gradient(12deg, #ff2400, #e81d1d, #e8b71d, #e3e81d, #1de840, #1ddde8, #2b1de8, #dd00f3, #dd00f3)'});
}

function isScrolledIntoView(elem) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();

    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
}

function attemptLogin() {
	// Submitted details
	var submittedUsername = $('#username').val().trim();
	var submittedPassword = $('#password').val().trim();
	
	console.log('Attempting login...');
	
	// Validate that username is at least 1 character and password is at least 8, otherwise show error animation
	if (submittedUsername.length > 0 && submittedPassword.length >= 8) {
		// Submit details to the server with AJAX
        var dataInput = {"username":submittedUsername,"password":submittedPassword};
        $.ajax({
            url: '/validate',
            data: JSON.stringify(dataInput),
            dataType: 'JSON',
            contentType: "application/json",
            method: 'POST',
            timeout: 5000,
        }).done((data)=>{
            console.log(data);
			// If correct details, animate and redirect. Else, show error animation
			if (data.result == 'OK') {
				successfulLogin();
			} else {
				networkImageAnimation();
			}
        });
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
    
function generateRandom(min,max) {
	return Math.round(Math.random() * (max-min)) + min;
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