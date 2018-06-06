"use strict";
var revChart;
var revisionDisplay = {
    load:(addr, data) => {
        console.log('Initializing chart!');
        
        var canvas = $(addr), 
        context = canvas[0].getContext('2d');
        
        var dimensions = Math.min($(window).height(),$(window).width())/2;
        context.canvas.height = dimensions;
        context.canvas.width = dimensions;
        
        revChart = new Chart(canvas, {
            type: 'doughnut',
            options: {
                cutoutPercentage: 25,
                animation:{
                    animateScale:true
                }
            },
            data: {
                labels: data[0],
                datasets: [{
                    label: '# of Votes',
                    data: data[1],
                    backgroundColor: [
                        'rgba(200, 200, 0, 0.6)',
                        'rgba(9, 130, 153, 0.6)',
                        'rgba(60, 255, 154, 0.6)',
                        'rgba(255, 67, 64, 0.6)',
                        'rgba(204, 20, 120, 0.6)',
                    ],
                    borderColor: [
                        'rgba(0,0,0,0.8)',
                        'rgba(0,0,0,0.8)',
                        'rgba(0,0,0,0.8)',
                        'rgba(0,0,0,0.8)',
                        'rgba(0,0,0,0.8)',
                    ],
//                    borderDash: [
//                        [5,10]
//                    ],
                    borderWidth: 5
                }]
            }
        });
        
        setInterval(()=>{
            revisionDisplay.update(revisionDisplay.calcImportance(userData));
        },8.64e7);
    },
    update:(data) => {
        console.log('Updating chart with data: ' + JSON.stringify(data));
        revChart.data.labels = data[0];
        revChart.data.datasets[0].data = data[1];

        revChart.update(1000);
    },
    calcImportance: (data) => {
        var priorityList = [];
        
        for (var count = 0; count < data.length; count++) {
            var startTime = new Date(data[count].start).getTime();
            var endTime = new Date(data[count].end).getTime();
            var crntTime = new Date().getTime();

            if (checkIfActive(startTime, endTime, crntTime)) {
                priorityList.push([`${data[count].name} in ${Math.floor((endTime - crntTime)/8.64e+7)} days`, Math.round(((endTime - startTime) / (endTime - crntTime)*5) * 100), endTime]);
            }
        }
        
        priorityList.sort(function(a,b){return a[2] > b[2]});
        priorityList = priorityList.slice(0,5);
        
        var names = [],
            severities = [];

        priorityList.forEach((element) => {
            names.push(element[0]);
            severities.push(element[1]);
        });
        
        return [names, severities];
    }
}