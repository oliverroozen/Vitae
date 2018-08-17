"use strict"

$(document).ready(()=>{
	$('select#uploadType').on('change',(event)=>{
//		$(`a#submitImage`).css({opacity:0});
		$(`div#content div.main div.uploadBox`).css({opacity:0,top:'40px'});
		$(`div#content div.main div.${event.target.value}Upload`).css({opacity:1,top:'0px'});
	});
	
	$('input#fileSelect').on('change',(event)=>{
		const displayImage = $('img#display');
		var url = event.target.value;
		var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
		
		displayImage.on('load',()=>{
			new Cropper(document.getElementById('display'),{
				viewMode: 3,
				movable: false,
				scalable: false,
				zoomable: false
			});
		});
		
		if (event.target.files && event.target.files[0]&& (ext == "gif" || ext == "png" || ext == "jpeg" || ext == "jpg")) {
			var reader = new FileReader();

			reader.onload = function (e) {
				displayImage.attr('src', e.target.result);
			}
			
			reader.readAsDataURL(event.target.files[0]);
		} else {
			alert('Invalid file type!');
		}
	});
});

function readURL(input) {
var url = input.value;
var ext = url.substring(url.lastIndexOf('.') + 1).toLowerCase();
if (input.files && input.files[0]&& (ext == "gif" || ext == "png" || ext == "jpeg" || ext == "jpg")) {
    var reader = new FileReader();

    reader.onload = function (e) {
        $('#img').attr('src', e.target.result);
    }
    reader.readAsDataURL(input.files[0]);
}
else{
     $('#img').attr('src', '/assets/no_preview.png');
  }
}