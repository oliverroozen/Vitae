"use strict";

// As soon as the DOM is ready to manipulate...
$(document).ready(()=>{
    if (/^\/user\//.test(window.location.pathname)) {
		$('div#title svg.logo').css({opacity:0.5,transform:'scale(1)'});
		
		setTimeout(()=>{	
			const distances = [30,85,150];
			var count = 0;
			var vAnimation = setInterval(()=>{
				if (distances[count]) {
					$('div#title svg.logo').eq(1).css({right:`${distances[count]}%`});
					$('div#title svg.logo').eq(2).css({left:`${distances[count]}%`});
				} else {
					clearInterval(vAnimation);
					
					// This is where we create a fuckton of elements and lag the page to shit
					generateElements(500,0);
				}
				count++;
			},100);
		},5000);
    } 
});

function generateElements(quantity,interval) {
	var container = $('div#content div#cascade');
	
	var elementCount = 0;
	setInterval(()=>{
		if (elementCount < quantity) {
			const colours = ['red','green','blue'];
			container.append(`<div class="cascadeElement" style="color:${colours[generateRandom(0,2)]};top:${generateRandom(0,100)}%;left:${generateRandom(0,200)}%;">V</div>`);
		} else {
			clearInterval(this);
		}
		elementCount++;
	},interval);
}