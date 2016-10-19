import './libs/d3/d3'; 
import TimeSeries from 'app/core/time_series2';
import kbn from 'app/core/utils/kbn';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {heatmapEditor, displayEditor, pluginName} from './properties';
import _ from 'lodash';
import './series_overrides_heatmap_ctrl';
import './css/heatmap.css!';

const panelOptions = {
	treeMap:{
    	modes: ['squarify', 'slice', 'dice', 'slice-dice'],
    	nodeSizeProperties: ['value', 'count'],
    	aggregationFunctions: ['sum', 'min', 'max', 'extent', 'mean', 'median', 'quantile', 'variance', 'deviation']
	}
};

const panelDefaults = {
	// other style overrides
    seriesOverrides: [],
	thresholds: '0,10',
	colors: ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'],
	legend: {
		show: true,
		min: true,
		max: true,
		avg: true,
		current: true,
		total: true,
		gradient: {
			enabled: true,
			show: true
		}
	},
	maxDataPoints: 100,
	mappingType: 1,
	nullPointMode: 'connected',
	format: 'none',
	valueName: 'avg',
	valueOptions: ['avg', 'min', 'max', 'total', 'current'],
    valueMaps: [
      { value: 'null', op: '=', text: 'N/A' }
    ],
    treeMap: {
    	mode: 'squarify',
    	groups: [{key:'server', value: '/^.*\./g'}],
    	aggregationFunction: 'mean',
    	enableTimeBlocks: false,
    	enableGrouping: true,
    	debug: false,
    	depth: 0,
    	ids: ['alias'],
    	nodeSizeProperty: "value"
    }
};

class HeatmapCtrl extends MetricsPanelCtrl {
	constructor($scope, $injector, $sce) {
		super($scope, $injector);
		_.defaults(this.panel, panelDefaults);
		
		this.options = panelOptions;
		this.panel.chartId = 'chart_' + this.panel.id;
		this.containerDivId = 'container_'+this.panel.chartId;
		this.$sce = $sce;
		this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
		this.events.on('data-received', this.onDataReceived.bind(this));
		this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
		this.initializePanel();
	}
	
	initializePanel(){
		var d3plusPath = 'plugins/'+pluginName+'/libs/d3plus/d3plus.full.js';
		var _this = this;
		var meta = {};
		meta[d3plusPath] = {
			      format: 'global'
	    };
		
		SystemJS.config({
			  meta: meta
			});

		SystemJS.import(d3plusPath).then(function d3plusLoaded(){
			console.log('d3plus is loaded');
			_this.events.emit('render');
		});
	}
	
	handleError(err){
		this.getPanelContainer().html('<p>Error:</p><pre>' + err + '</pre>');
	}
	
	onInitEditMode() {
		this.addEditorTab('Heatmap', heatmapEditor, 2);
		this.addEditorTab('Display', displayEditor, 3);
	}
	
	getPanelContainer(){
		return $(document.getElementById(this.containerDivId));
	}
	
	onDataReceived(dataList){
		console.info('received data');
		console.debug(dataList);
		this.series = dataList.map(this.seriesHandler.bind(this));
		console.info('mapped dataList to series');

		var preparedData = this.d3plusDataProcessor(this.series);
		this.render(preparedData);
	}
	
	/**
	 * Prepare data for d3plus
	 */
	d3plusDataProcessor(dataArray){
		var resultArray = [];
		
		if(this.panel.treeMap.groups.length < 1){
			// just add the original items since there are no groups
			for (var dataIndex=0; dataIndex < dataArray.length; dataIndex++){
				var newDataItem = Object.assign({}, dataArray[dataIndex]);
				resultArray.push(newDataItem);
			}
		} else {
			// Process Groups
			for(var groupIndex=0; groupIndex<this.panel.treeMap.groups.length; groupIndex++){
				var key = this.panel.treeMap.groups[groupIndex].key;
				var value = this.panel.treeMap.groups[groupIndex].value;
				var regex = kbn.stringToJsRegex(value);
				
				for (var dataIndex=0; dataIndex < dataArray.length; dataIndex++){
					var newDataItem = Object.assign({}, dataArray[dataIndex]);
					var matches = newDataItem.alias.match(regex);
					if (matches && matches.length > 0){
						console.debug('group:'+key +'\nalias:'+ newDataItem.alias + '\nregex:' + regex +'\nmatches:' + matches);
						newDataItem[key] = matches[0];
					} else {
						newDataItem[key] = 'NA';
					}
					resultArray.push(newDataItem);
				}
			}
		}
		
		// add items for time blocks
		if(this.panel.treeMap.enableTimeBlocks){
			console.info('creating timeblock records')
			var timeBlockArray = [];
			for (var dataIndex=0; dataIndex < resultArray.length; dataIndex++){
				console.debug('dataIndex:'+dataIndex+', alias:'+resultArray[dataIndex].alias);
				var dataSeries = resultArray[dataIndex];
				for(var dataPointIndex=0; dataPointIndex < dataSeries.flotpairs.length; dataPointIndex++){
					var dataSeriesCopy = Object.assign({}, dataSeries);
					delete dataSeriesCopy.datapoints;
					delete dataSeriesCopy.flotpairs;
					dataSeriesCopy.timestamp = dataSeries.flotpairs[dataPointIndex][0];
					dataSeriesCopy.value = dataSeries.flotpairs[dataPointIndex][1];
					timeBlockArray.push(dataSeriesCopy);
				}
			}
			resultArray = timeBlockArray;
		} else {
			
		}
		return resultArray;
	}
	
	/**
	 * Series Handler
	 */
	seriesHandler(seriesData) {
		var series = new TimeSeries({
			datapoints: seriesData.datapoints,
			alias: seriesData.target.replace(/"|,|;|=|:|{|}/g, '_')
		});
	    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
	    series.value = series.stats[this.panel.valueName];
	    return series;
	} // End seriesHandler()
	
	addSeriesOverride(override) {
		this.panel.seriesOverrides.push(override || {});
	}
	
	addTreeMapGroup(group) {
		this.panel.treeMap.groups.push(group || {});
	}

	removeSeriesOverride(override) {
		this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
	    this.render();
	}
	
	removeTreeMapGroup(group) {
		this.panel.treeMap.groups = _.without(this.panel.treeMap.groups, group);
	    this.render();
	}
	
	updateThresholds(){
		var thresholdCount = this.panel.thresholds.length;
		var colorCount = this.panel.colors.length;
		this.refresh();
	}
	
	changeColor(colorIndex, color){
		this.panel.colors[colorIndex] = color;
	}
	
	removeColor(colorIndex){
		this.panel.colors.splice(colorIndex,1);
	}
	
	addColor(){
		this.panel.colors.push('rgba(255, 255, 255, 1)');
	}
	
	getGradientForValue(data, value){
		console.info('Getting gradient for value');
		console.debug(data);
		console.debug(value);
		var min = Math.min.apply(Math, data.thresholds);
		var max = Math.max.apply(Math, data.thresholds);
		var absoluteDistance = max - min;
		var valueDistanceFromMin = value - min;
		var xPercent = valueDistanceFromMin/absoluteDistance;
		// Get the smaller number to clamp at 0.99 max
		xPercent = Math.min(0.99, xPercent);
		// Get the larger number to clamp at 0.01 min
		xPercent = Math.max(0.01, xPercent);
		
		return getColorByXPercentage(this.canvas, xPercent);
	}
	
	applyOverrides(seriesItemAlias){
		var seriesItem = {}, colorData = {}, overrides = {};
		console.info('applying overrides for seriesItem');
		console.debug(seriesItemAlias);
		console.debug(this.panel.seriesOverrides);
		for(var i=0; i<=this.panel.seriesOverrides.length; i++){
			console.debug('comparing:');
			console.debug(this.panel.seriesOverrides[i]);
			if (this.panel.seriesOverrides[i] && this.panel.seriesOverrides[i].alias == seriesItemAlias){
				overrides = this.panel.seriesOverrides[i];
			}
		}
		colorData.thresholds = (overrides.thresholds || this.panel.thresholds).split(',').map(function(strVale) {
			return Number(strVale.trim());
		});
		colorData.colorMap = this.panel.colors;
		seriesItem.colorData = colorData;
		
		seriesItem.valueName = overrides.valueName || this.panel.valueName;
		
		return seriesItem;
	}
	
	invertColorOrder() {
	    this.panel.colors.reverse();
	    this.refresh();
	}
	
	addTreeMapId(){
		this.panel.treeMap.ids.push('');
		this.refresh();
	}
	
	removeTreeMapId(pos){
		this.panel.treeMap.ids.splice(pos,1);
		this.refresh();
	}
	
	changeTreeMapId(idString, pos){
		this.panel.treeMap.ids[pos] = idString;
	}

	getDecimalsForValue(value) {
	    if (_.isNumber(this.panel.decimals)) {
	      return {decimals: this.panel.decimals, scaledDecimals: null};
	    }

	    var delta = value / 2;
	    var dec = -Math.floor(Math.log(delta) / Math.LN10);
	
	    var magn = Math.pow(10, -dec),
	      norm = delta / magn, // norm is between 1.0 and 10.0
	      size;
	
	    if (norm < 1.5) {
	      size = 1;
	    } else if (norm < 3) {
	      size = 2;
	      // special case for 2.5, requires an extra decimal
	      if (norm > 2.25) {
	        size = 2.5;
	        ++dec;
	      }
	    } else if (norm < 7.5) {
	      size = 5;
	    } else {
	      size = 10;
	    }
	
	    size *= magn;
	
	    // reduce starting decimals if not needed
	    if (Math.floor(value) === value) { dec = 0; }
	
	    var result = {};
	    result.decimals = Math.max(0, dec);
	    result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;
	
	    return result;
	}
	
	link(scope, elem, attrs, ctrl) {
		var chartElement = elem.find('.heatmap');
		chartElement.append('<div id="'+ctrl.containerDivId+'"></div>');
	    var chartContainer = $(document.getElementById(ctrl.containerDivId));
    	console.debug('found chartContainer');
    	console.debug(chartContainer);
    	elem.css('height', ctrl.height + 'px');
    	

    	function render(data){
    		updateSize();
    		updateChart(data);
    	}
    	
    	function updateSize(){
    		elem.css('height', ctrl.height + 'px');
    	}
    	
    	function updateChart(data){
    		d3.select("#"+ctrl.containerDivId).selectAll('*').remove();
    		
    		/*data = [
    		        {"value": 100, "alias": "alpha", "group": "group 1"},
    		        {"value": 70, "alias": "beta", "group": "group 2"},
    		        {"value": 40, "alias": "gamma", "group": "group 2"},
    		        {"value": 15, "alias": "delta", "group": "group 2"},
    		        {"value": 5, "alias": "epsilon", "group": "group 1"},
    		        {"value": 1, "alias": "zeta", "group": "group 1"}
    		      ];*/
    		
    		

    		// Make sure the necessary IDs are added
    		var idKeys = Array.from(ctrl.panel.treeMap.ids);
    		ensureArrayContains(idKeys, 'alias');
    		if(ctrl.panel.treeMap.enableTimeBlocks){
    			ensureArrayContains(idKeys, 'timestamp');
    		}
    		
    		// Setup Aggregations 
    		var aggs = {};
    		aggs.value = ctrl.panel.treeMap.aggregationFunction;
    		
    		d3plus.viz()
				.dev(ctrl.panel.treeMap.debug)
    			.aggs(aggs)
    			.container("#"+ctrl.containerDivId)
    			.data(data)
    			//.type("tree_map")
    			.type({"mode": ctrl.panel.treeMap.mode})    // sets the mode of visualization display based on type    
    			.id({
    				"value": _.uniq(idKeys),
    				"grouping": ctrl.panel.treeMap.enableGrouping
    			})
    			.depth(Number(ctrl.panel.treeMap.depth))
    			.size("value")
    			.height(ctrl.height)
    			.width(ctrl.width)
    			.color({
    				"heatmap": [ "grey" , "purple" ],
    			    "value": "value"
    			})
    			.format({ "text" : function( text , key ) {
				    return text;
				  }
				})
    			.draw();
    	}
    	
    	this.events.on('render', function onRender(data) {
    		if(typeof d3plus !== 'undefined' && data){
    			render(data);
    			ctrl.renderingCompleted();
    		} else {
    			console.info('d3plus is not loaded yet');
    		}
	    });
	    
	}
// End Class
}

function ensureArrayContains(array, value) {
	if (array.indexOf(value) == -1) {
		array.push(value);
	}
}

function getColorForValue(data, value) {
	console.info('Getting color for value');
	console.debug(data);
	console.debug(value);
	for (var i = data.thresholds.length; i > 0; i--) {
		if (value >= data.thresholds[i-1]) {
		return data.colorMap[i];
	}
  }
  return _.first(data.colorMap);
}

HeatmapCtrl.templateUrl = 'module.html';

export {
	HeatmapCtrl,
	HeatmapCtrl as MetricsPanelCtrl
};