import * as d3 from 'd3';
import {HeatmapVizProperties} from "./HeatmapViz";

const vizClass = '.heatmap-viz';
const fakeData = {
        "name": "root",
        "children": [
            {
                "name": "parent1",
                "children": [
                    {
                        "name": "child1-1",
                        "value": 1236670000
                    },
                    {
                        "name": "child1-2",
                        "value": 1361170000
                    }]
            },
            {
                "name": "parent2",
                "children": [
                    {
                        "name": "child2-1",
                        "value": 173615000
                    },
                    {
                        "name": "child2-2",
                        "value": 83661000
                    }]
            },
        ]
    };

const defaults = {
    margin: {top: 24, right: 0, bottom: 0, left: 0},
    format: ",d",
    title: "",
    width: 960,
    height: 500,
    tile: d3.treemapSquarify,
    textFill: '#eee',
    rectFill: 'rgba(168,11,7,0.55)',
    rectStroke: "#eee"
};

function main(o: any, data: d3.HierarchyNode<any>) {
    data.sum(d => {
        return d.value;
    });
    const opts = $.extend(true, {}, defaults, o),
        margin = opts.margin,
        theight = 36 + 16;

    const width = opts.width - margin.left - margin.right,
        height = opts.height - margin.top - margin.bottom - theight;

    const treemap = d3.treemap()
        .tile(opts.tile)
        .size([width, height])
        .paddingTop(20)
        .paddingInner(4)
        .round(false);
    treemap(data);
    const nodes = d3.select(`${vizClass} svg g`)
        .selectAll('g')
        .data(data.descendants())
        .enter()
        .append('g')
        .attr('transform', (d: any) => {
            return 'translate(' + [d.x0, d.y0] + ')';
        });

    nodes
        .append('rect')
        .attr('width', (d: any) => {
            return d.x1 - d.x0;
        })
        .attr('height', (d: any) => {
            return d.y1 - d.y0;
        })
        .style('fill', (d: d3.HierarchyNode<any>) => {
            return opts.rectFill;
        });

    nodes
        .append('text')
        .attr('dx', 4)
        .attr('dy', 14)
        .text((d: any) => {
            return d.data.name;
        });
}

const draw = (props: HeatmapVizProperties) => {
    d3.select(`${vizClass} > *`).remove();
    const svg = d3.select(`${vizClass}`).append('svg')
        .attr('height', props.height)
        .attr('width', props.width)
        .style('background-color', '#333');
    svg.append('g');
    const root = d3.hierarchy(fakeData);
    main(props, root);
};

export default draw;
