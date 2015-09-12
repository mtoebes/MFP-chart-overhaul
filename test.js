var moving_average_lookback=7;
var oneDay=24*60*60*1000;
var chart_options;
var daily_data,moving_data;
var date_range = [];
var reportInfo={
	category:null,
	id:1,
	name:null,
	date_range:{"start" : 0, "end" : 0},
	limit_range:{"start" : 0, "end" : 0},
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
		date_range:getDateRangeFromPeriod(7),
		limit_range:getDateRangeFromPeriod(365),
	};
	makeMeasurementRequest(new_reportInfo, 7, 0);
});

$(".period").click(function(e) {
	var button = $(e.target);
	var period = button.attr("data-period");
	console.log("period clicked " + period);
	var new_date_range = getDateRangeFromPeriod(period);
	updateDateRange(new_date_range);
	updateChart(reportInfo.category == "progress");

});

$(".active-result").click(function(e) {
	var button = $(e.target);
	var name = (button.text()).toLowerCase();
	var category = (getCategory(button.attr("id")).toLowerCase());
	console.log("active-result clicked " + name + " " + category);
	if(name != reportInfo.name) {
		updateName(name, category);
		updateDateRange(reportInfo.date_range);
		updateChart(reportInfo.category == "progress");
	}
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
		var measurement = getMeasurementByName(reportInfo.name);
		if(measurement != null) {
			showSlider(true, reportInfo);
			chart_options.series[0].data=measurement.daily_data;
			chart_options.series[1].data=measurement.moving_data;
			$('#highchart2').highcharts(chart_options);
			$('#highchart2').show();
			$('#highchart').hide();
		} else {
			showSlider(false);
			var new_reportInfo = $.extend(true, {}, reportInfo);
			var lookback = DateDif(new_reportInfo.date_range.start, new_reportInfo.date_range.end);
			makeMeasurementRequest(new_reportInfo, lookback, 0);
		}
	} else {
		showSlider(false);
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
	chart_options.title.text=new_name.capitalize();
	chart_options.yAxis[0].title.text=new_name.capitalize();
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

function updateDateRange(new_date_range) {
	reportInfo.date_range = new_date_range;

	if($("#dateRulersExample").is(':visible')){
		$("#dateRulersExample").dateRangeSlider("min", new Date(reportInfo.date_range.start));
		$("#dateRulersExample").dateRangeSlider("max", new Date(reportInfo.date_range.end));
	}

	var new_limit_range = getLimits();
	reportInfo.limit_range = new_limit_range;
	chart_options.xAxis[0].min=new_limit_range.start;
	chart_options.xAxis[0].max=new_limit_range.end;
	chart_options.xAxis[0].tickInterval=getTickInterval();
}

function makeMeasurementRequest(new_reportInfo, lookback, index) {
	var search_length = lookback + 7;
	$.get("http://www.myfitnesspal.com/reports/results/"+new_reportInfo.category+"/"+new_reportInfo.id+"/"+search_length+".json?",function (raw_results){
		if(index == 0 || raw_results.data.length == 0) {
			console.log("showing");
			parseData(raw_results);
			updateName(new_reportInfo.name, new_reportInfo.category);
            updateDateRange(new_reportInfo.date_range);
            updateChart(reportInfo.category == "progress");
		}
		if(raw_results.data.length == 0)
			return;
		else if(raw_results.data[0].total == 0) {
			parseData(raw_results);
			showSlider(true, new_reportInfo);
		} else {
			index += 1;
			makeMeasurementRequest(new_reportInfo, 2*lookback, index);
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
		'slider_options' : {}
	};
	cur_year=new Date().getFullYear();
	for(i=raw_data.length-1;i>=0;i--){
		var entry=raw_data[i];
		if(i>0){
			var prev_entry=raw_data[i-1];
			var cur_month = parseInt(entry.date.split("/")[0]);
			var prev_month = parseInt(prev_entry.date.split("/")[0]);

			if(cur_month < prev_month)
				cur_year--;
			if(entry.total!=prev_entry.total&&entry.total!=0){
				var cur_date=parseDateString(entry.date,cur_year);
				measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
			}
		} else {
			if(entry.total!=0){
				var cur_date=parseDateString(entry.date,cur_year);
				measurement.data.push({'date_string':entry.date,'dateUTC':cur_date,'total':entry.total});
			}
		}
	}

	measurement.data.reverse();
	var today = getToday();
	if(measurement.data.length == 0) {
		var date_range = {'start' : today - oneDay*7, 'end' : today};
	} else {
		var date_range = {'start' : measurement.data[0].dateUTC, 'end' : today};
		if(measurement.data[measurement.data.length-1].dateUTC < today)
			measurement.data.push({'date_string':"today",'dateUTC':today,'total':measurement.data[measurement.data.length-1].total});
	}
	measurement.slider_options = createSliderOptions(date_range);
	measurement.daily_data=daily_value(measurement.data);
	measurement.moving_data=moving_average(measurement.data);
	setMeasurementByName(name, measurement);
}

function getToday() {
	var curTime=new Date();
	return Date.UTC(curTime.getFullYear(),curTime.getMonth(),curTime.getDate());
}

function getDateRangeFromPeriod(period) {
	var end = getToday();
	var start = end - (period-1)*oneDay;
	return {"start" : start, "end" : end};
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

function getTickInterval(){
	var period=DateDif(reportInfo.limit_range.start, reportInfo.limit_range.end)
	if(period<=14){
		return oneDay;;
	}else if(period<=30){
		return 2*oneDay;
	}else if(period<=90){
		return 7*oneDay;
	}else{
		return 14*oneDay;
	}
}

function getLimits(){
	var measurement = getMeasurementByName(reportInfo.name);
	if(measurement == null) {
		return {
			'start':reportInfo.date_range.start,
			'end' : reportInfo.date_range.end
		};
	} else if(measurement.daily_data.length==0) {
		return {
			'start':getGlobal(measurement.slider_options.bounds.min),
			'end' : getGlobal(measurement.slider_options.bounds.max)
		};
	} else {
		return {
			'start' : Math.max(reportInfo.date_range.start, measurement.data[0].dateUTC),
			'end' : Math.min(reportInfo.date_range.end, measurement.data[measurement.data.length-1].dateUTC)
		};
	}
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
			},
			animation : false
		}, {
			data : [],
			name : "Average",
			type : "spline",
			dataLabels : {enabled : false},
			marker : {
				enabled : false,
				symbol : "circle",
				radius : 2
			},
			animation : false
		}],
		plotOptions : {
			line : {lineWidth : 0, states : {hover : { lineWidth : 0, lineWidthPlus : 0 }}}
		},
		chart : {
			renderTo : "highchart2",
			style : {
				fontFamily: "\"Lucida Grande\", \"Lucida Sans Unicode\", Verdana, Arial, Helvetica, sans-serif",
				fontSize: "12px"
			},
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
			startOnTick:true,
			minRange : 1,
			minTickInterval : 1,
			allowDecimals : false
		}],
		xAxis : [{
			type:'datetime',
			lineColor:"#C0C0C0",
			tickColor:"#C0C0C0",
			tickmarkPlacement:"on",
			//startOnTick:true,
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

function createSliderOptions(date_range) {
	var options = {bounds : {}, scales : [], defaultValues: null, step : {days : 1}};
	var range = DateDif(date_range.start, date_range.end) + 1;
	if(range <= 31) {
		options.bounds = {
			"min" : getLocal(date_range.start),
			"max" : getLocal(date_range.end)};
    	options.scales = [getDayScale()];
	} else if(range <= 480) {
		options.bounds = {
			"min" : getLocal(getMonthMinMax(date_range.start).min),
			"max" : getLocal(getMonthMinMax(date_range.end).max)};
		options.scales = [getMonthScale(true), getWeekScale()];
	} else {
		options.bounds = {
			"min" : getLocal(getYearMinMax(date_range.start).min),
			"max" : getLocal(getYearMinMax(date_range.end).max)};
		options.scales = [getYearScale(true), getMonthScale(false)];
	}
	return options;
}

function getYearMinMax(value) {
	var start = new Date(value);
	var start = new Date(start.getFullYear(), 0, 1);
	var end = new Date(start.getFullYear()+1,0,0);
	return {'min' : start.getTime(), 'max' : end.getTime()};
}

function getMonthMinMax(value) {
	var start = new Date(value);
	var start = new Date(start.getFullYear(), start.getMonth(), 1);
	var end = new Date(start.getFullYear(), start.getMonth()+1, 0);
	return {'min' : start.getTime(), 'max' : end.getTime()};
}

function getWeekMinMax(value) {
	var start = new Date(value);
	start.setUTCDate(Math.floor((value.getDate()-1)/7)*7+1);
	var end = new Date(start);
	end.setUTCDate(start.getDate() + 8);
	if(end.getMonth() != start.getMonth())
		end = new Date(start.getFullYear(), start.getMonth()+1, 1);
	return {'min' : start.getTime(), 'max' : end.getTime()};
}

function getDayScale() {
	return {
		next: function(value){
			var cur = new Date(value)
			var next = new Date(value.getFullYear(), value.getMonth(), value.getDate()+1);
			return next;

		},
		label: function(value){
			return null;
		},
	}
}

function getWeekScale() {
	return {
		next: function(value){
			var cur = new Date(value)
			var next = new Date(value.getFullYear(), value.getMonth(), value.getDate()+7);
			if(next.getMonth() != cur.getMonth())
				next = new Date(next.getFullYear(), next.getMonth(), 1);
			return next;

		},
		label: function(value){
			return null;
		},
	}
}

function getYearScale(isLabel) {
	return {
		next: function(value){
			var cur = new Date(value);
			return new Date(cur.getFullYear()+1, 0, 1);
		},
		label: function(value){
			if(isLabel)
				return value.getFullYear();
			else
				return null;
		},
	}
}

function getMonthScale(isLabel) {
	var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
	return  {
		next: function(value){
			var cur = new Date(value);
			return new Date(cur.getFullYear(), cur.getMonth()+1, 1);
		},
		label: function(value){
			if(isLabel)
				return months[value.getMonth()];
			else
				return null;
		},
	}
}
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function showSlider(show, new_reportInfo) {
	if(show) {
		if(new_reportInfo.name != reportInfo.name)
    		return;
		var measurement = getMeasurementByName(new_reportInfo.name);
		if(measurement != null) {
			measurement.slider_options.defaultValues = {'min': new_reportInfo.limit_range.start, 'max': new_reportInfo.limit_range.end};
			$("#dateRulersExample").dateRangeSlider(measurement.slider_options);
			$("#dateRulersExample").show()
		} else {
			$("#dateRulersExample").hide();
		}
	} else {
		$("#dateRulersExample").hide();
	}
}

function getLocal(time) {
	var today = new Date();
	var offset = today.getTimezoneOffset()*60000;
	return time+offset;
}

function getGlobal(time) {
	var today = new Date();
	var offset = today.getTimezoneOffset()*60000;
	return time-offset;
}

var div=$("#highchart").clone().attr("id","highchart2");
$(div).insertAfter($("#highchart"));

var slider = document.createElement('div');
slider.id = "dateRulersExample";
$("#reports-menu").append(slider);

$("#dateRulersExample").hide();
$("#dateRulersExample").bind("userValuesChanged", function(e, data){
	$(".period.active").attr('class','period');
	console.log("Values just changed. min: " + data.values.min + " max: " + data.values.max);
	var new_date_range = {"start" : getGlobal(data.values.min.getTime()), "end" :getGlobal(data.values.max.getTime())};
	updateDateRange(new_date_range);
	updateChart(reportInfo.category == "progress");
});
