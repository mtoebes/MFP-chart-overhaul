var moving_average_lookback=7;
var oneDay=24*60*60*1000;
var chart_options;
var daily_data,moving_data;
var date_range = [];
var reportInfo={
	category:null,
	id:1,
	name:null,
	period:0,
};
var measurements = {
	'weight' : null,
	'neck' : null,
	'waist' : null,
	'hips' : null,
}

$(document).ready(function (){
	console.log("ready");
	createChartBasics();
	var new_reportInfo = {
		category : "progress",
		name : "weight",
		id : 1,
		period : 7,
	};
	makeMeasurementRequest(new_reportInfo, 7, 0);
});

$(".period").click(function(e) {
	var button = $(e.target);
	var period = button.attr("data-period");
	console.log("period clicked " + period);
	if(period != reportInfo.period) {
		updatePeriod(period);
		updateChart(reportInfo.category == "progress");
	}
});

$(".active-result").click(function(e) {
	var button = $(e.target);
	var name = (button.text()).toLowerCase();
	var category = (getCategory(button.attr("id")).toLowerCase());
	console.log("active-result clicked " + name + " " + category);
	if(name != reportInfo.name) {
		updateName(name, category);
		updatePeriod(reportInfo.period);
	}
	updateChart(category == "progress");
});

function getCategory(report_id) {
	var leading = "report_chzn_o_";
	var num = parseInt(report_id.substring(report_id.indexOf(leading)+leading.length));
	if(num < 5) {
		return "progress";
	}else if(num < 24) {
		return "nutrition";
	}else {
		return "fitness";
	}
}

function updateChart(showChart) {
	if(showChart) {
		$('#highchart2').highcharts(chart_options);
		$('#highchart2').show();
		$('#highchart').hide();
	} else {
		$('#highchart').show();
		$('#highchart2').hide();
	}
}

function showChart(show) {
	console.log("entered");
	if(show) {
		console.log("show chart");
		$('#highchart2').show();
		$('#highchart').hide();
	} else {
		console.log("hide chart");
		$('#highchart').show();
		$('#highchart2').hide();
	}
}

function updateName(new_name, new_category) {
	reportInfo.name = new_name;
	reportInfo.category = new_category;
	if(new_category != "progress")
		return;
	reportInfo.id = getId(name);
	updateData(new_name);
	chart_options.title.text=new_name.capitalize();
	chart_options.yAxis[0].title.text=new_name.capitalize();
}

function updateData(name) {
	var measurement = getMeasurementByName(name);
	if(measurement != null) {
		chart_options.series[0].data=measurement.daily_data;
		chart_options.series[1].data=measurement.moving_data;
	} else {
		makeMeasurementRequest(reportInfo, reportInfo.period, 0);
	}
}

function getId(name) {
	if(reportInfo.name=='neck')
		return 82719721;
	else if(reportInfo.name=='waist')
		return 82719722;
	else if(reportInfo.name=='hips')
		return 82719723;
	else
		return 1;
}

function updatePeriod(new_period) {
	reportInfo.period = new_period;
	var measurement = getMeasurementByName(reportInfo.name);
	var limits=getLimits(measurement);
	chart_options.xAxis[0].min=limits.x_min;
	chart_options.xAxis[0].max=limits.x_max;
	chart_options.yAxis[0].min=limits.y_min;
	chart_options.yAxis[0].max=limits.y_max;
	chart_options.xAxis[0].tickInterval=getTickInterval(limits.x_min,limits.x_max);
}

function makeMeasurementRequest(new_reportInfo, period_length, index) {
	var search_length = period_length + 7;
	$.get("http://www.myfitnesspal.com/reports/results/"+new_reportInfo.category+"/"+new_reportInfo.id+"/"+search_length+".json?",function (raw_results){
		if(index == 0 || raw_results.data.length == 0) {
			console.log("showing");
			parseData(raw_results);
			updateName(new_reportInfo.name, new_reportInfo.category);
            updatePeriod(new_reportInfo.period);
			updateChart(new_reportInfo.category == "progress");
		}
		if(raw_results.data.length == 0)
			return;
		else if(raw_results.data[0].total == 0) {
			parseData(raw_results);
			updateData(new_reportInfo.name);
			console.log("lookback period is " + period_length);
		} else {
			index += 1;
			makeMeasurementRequest(new_reportInfo, 2*period_length, index);
		}
	});
}

function parseData(raw_results){
	var name = (raw_results.title).toLowerCase()
	var raw_data = raw_results.data;
	var measurement = {
		'data' : [],
		'daily_data' : [],
		'moving_data' : [],
		'lookback_limit' : -1,
	};
	cur_year=new Date().getFullYear();
	for(i=raw_data.length-1;i>=0;i--){
		var entry=raw_data[i];
		if(i>0){
			var prev_entry=raw_data[i-1];
			if(prev_entry.date>entry.date)
				cur_year--;
			if(entry.total!=prev_entry.total&&entry.total!=0){
				var cur_date=parseDateString(entry.date,cur_year);
				measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
			}
		}else{
			if(entry.total!=0){
				var cur_date=parseDateString(entry.date,cur_year);
				measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
			}
		}
	}

	measurement.data.reverse();
	var today = getToday();
	if(measurement.data.length>0&&measurement.data[measurement.data.length-1].dateUTC<today)
		measurement.data.push({'date_string':"today",'dateUTC':today,'total':measurement.data[measurement.data.length-1].total});
	measurement.daily_data=daily_value(measurement.data);
	measurement.moving_data=moving_average(measurement.data);
	if(measurement.data.length > 0)
 	    measurement.lookback_limit = measurement.data[0].dateUTC;
	setMeasurementByName(name, measurement);
}

function getToday() {
	var curTime=new Date();
	return Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
}

function getDateRange() {
	var curTime=new Date();
	var today = Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
	var lookback_day = today - reportInfo.period*oneDay;
	return [lookback_day, today];
}

function parseDateString(date_string,year){
	var split_string=date_string.split("/");
	var day=split_string[1];
	var month=split_string[0];
	return Date.UTC(year,month-1,day);
}

function DateDif(date1,date2){
	var diffDays=(date2-date1)/oneDay;
	return diffDays;
}

function daily_value(data){
	result=[];
	data.forEach(function (entry,index){
		result.push([entry.dateUTC,entry.total]);
	});
	return result;
}

function moving_average(data){
	var result=[];
	for(i=0;i<data.length;i++) {
		var entry = data[i];
		var sum = 0;
		var num = 0;
		for(j=i; j>=0; j--) {
			var cur_entry=data[j];
			if(DateDif(cur_entry.dateUTC,entry.dateUTC)>=moving_average_lookback){
				break;
			} else {
				sum+=cur_entry.total;
				num++;
			}
		}
		var average = parseFloat((sum/num).toFixed(1));
		result.push([entry.dateUTC,average]);
	}
	return result;
}

function getTickInterval(x_min,x_max){
	var period=(x_max-x_min)/oneDay;
	if(period<=7){
		return oneDay;;
	}else if(period<=30){
		return 2*oneDay;
	}else if(period<=90){
		return 7*oneDay;
	}else{
		return 14*oneDay;
	}
}

function getLimits(measurement){
	if(measurement == null || measurement.daily_data.length==0)
		return {'x_min':0,'x_max':7,'y_min':0,'y_max':1};
	var date_range = getDateRange();
	var limits={'x_min':date_range[0],'x_max':date_range[1],'y_min':Number.MAX_VALUE,'y_max':Number.MIN_VALUE};
	for(i=measurement.data.length-1;i>=0;i--){
		var day_entry = measurement.daily_data[i];
		var avg_entry = measurement.moving_data[i];
		if(day_entry[0]<limits.x_min)
			break;
		else if(i==0)
			limits.x_min=day_entry[0];

		limits.y_min = Math.min(day_entry[1], avg_entry[1], limits.y_min);
		limits.y_max = Math.max(day_entry[1], avg_entry[1], limits.y_max);
	}
	console.log(limits.x_min +" " + limits.x_max + " " + limits.y_min + " "+ limits.y_max);
	return limits;
}

function getDateRange() {
	var curTime=new Date();
	var today = Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
	var lookback_day = today - reportInfo.period*oneDay;
	return [lookback_day, today];
}

function getMeasurementByName(name) {
	return measurements[name];
}

function setMeasurementByName(name, measurement) {
	measurements[name] = measurement;
}

function createChartBasics(){
	chart_options = {
		colors : ["#f7941e"],
		title : {
			text : "PLACEHOLDER",
			y : 15,
			style : {
				color : "#274b6d",
				fill : "#274b6d",
				fontSize : "26px"
			}
		},
		series : [{
			data : [],
			name : "Daily",
			type : "line",
			dataLabels : {enabled : false},
			marker : {
				enabled : true,
				symbol : "circle",
				radius : 2
			}
		}, {
			data : [],
			name : "Average",
			type : "spline",
			dataLabels : {enabled : false},
			marker : {
				enabled : false,
				symbol : "circle",
				radius : 2
			}
		}],
		plotOptions : {
			line : {lineWidth : 0, states : {hover : { lineWidth : 0, lineWidthPlus : 0 }}}
		},
		chart : {
			renderTo : "highchart2",
			style : {
				fontFamily: "\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
				fontSize: "12px"
			}
        },
		tooltip : {
			shared:true,
			headerFormat:"<spanstyle=\"font-size:10px\">{point.key}</span><br/>",
			pointFormat:"<spanstyle=\"color:{series.color}\">{series.name}</span> : <b>{point.y:.1f}</b><br/>",
		},
		yAxis: [{
			title : {
				text : "PLACEHOLDER",
				style : {fontSize : "16px", color : "#4d759e", fontWeight: "bold"}
			},
			minRange : 1,
			minTickInterval : 1,
			allowDecimals : false
		}],
		xAxis : [{
			type:'datetime',
			lineColor:"#C0C0C0",
			tickColor:"#C0C0C0",
			tickmarkPlacement:"on",
			startOnTick:true,
			dateTimeLabelFormats:{day:'%b %d',week:'%b %d',month:'%b %d',year:'%b %d'},
			labels: {
				align : "right",
				rotation : -90,
				step : 1,
				x : 4,
				y : 10,
				style : {
					fontFamily: "Verdana, sans-serif",
					fontSize : "13px"
				}
			}
		}],
		legend : {
			borderColor : "#909090",
			borderWidth : 1,
			borderRadius : 5 ,
		},
		exporting: { enabled: false }
	};
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

var div=$("#highchart").clone().attr("id","highchart2");
$(div).insertAfter($("#highchart"));
//div.hide();

/*
var slider = document.createElement('div');
slider.id = "dateRulersExample";
$("#reports-menu").append(slider);
var maxUTC = 1441756800000;
var minUTC = 1421625600000;
		var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
          $("#dateRulersExample").dateRangeSlider({
            bounds: {min: new Date(minUTC), max: new Date(maxUTC)},
            defaultValues: {min: new Date(minUTC), max: new Date(maxUTC)},
            scales: [{
              first: function(value){ return value; },
              end: function(value) {return value; },
              next: function(value){
                var next = new Date(value);
                return new Date(next.setMonth(value.getMonth() + 1));
              },
              label: function(value){
                return months[value.getMonth()];
              },
              format: function(tickContainer, tickStart, tickEnd){
                tickContainer.addClass("myCustomClass");
              }
            }]
          });*/