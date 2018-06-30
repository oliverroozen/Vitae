var sass = require("sass");
var fs = require('fs');

const dir = 'site/static/stylesheets';
const sassRenderOptions = {
    file: dir + "/sass/index.scss",
    outputStyle: 'compressed',
    outFile: '/to/my/output.css'
};

console.log('Started...');
sassRender();

fs.watch(dir+"/sass", (eventType, filename) => {
    console.log(`event type is: ${eventType}`);
    if (filename) {console.log(`filename changed: ${filename}`)};
    sassRender();
});

function sassRender() {
	sass.render(sassRenderOptions,function(error, result) {
        if (error) {console.log(error)} else {
            console.log(result);
            fs.writeFile(dir+'/style.css', result.css, function(err) {
                if(err) {return console.log(err)};
                console.log("The file was saved!");
            }); 
        }
    });
}