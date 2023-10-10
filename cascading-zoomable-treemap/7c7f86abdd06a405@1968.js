// https://observablehq.com/@albutko/cascading-zoomable-treemap@1968
export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], function(md){return(
md`# Cascading Zoomable Treemap`
)});
  main.variable(observer()).define(["md"], function(md){return(
md`This viz is based on the [D3 cascading treemap](https://observablehq.com/@d3/cascaded-treemap]) and [ganshev's](https://bl.ocks.org/ganeshv) [zoomable treemap](http://bl.ocks.org/ganeshv/6a8e9ada3ab7f2d88022)`
)});
  main.variable(observer("chart")).define("chart", ["d3","width","height","DOM","treemapDims","offset","treemap","data","getNestedCloseRelatives","rectifyDimensions","format"], function(d3,width,height,DOM,treemapDims,offset,treemap,data,getNestedCloseRelatives,rectifyDimensions,format)
{
  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible")
      .style("font", "10px sans-serif");
  
  const margin = {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10
  }
  
  const strokeWidth = 1 ;
  const strokeColor = "white";
  const activeParentStrokeWidth = 3;
  const activeParentStrokeColor = "white";
  
  
  const shadow = DOM.uid("shadow");

  svg.append("filter")
      .attr("id", shadow.id)
    .append("feDropShadow")
      .attr("flood-opacity", 0.3)
      .attr("dx", 0)
      .attr("stdDeviation", 3);
  
  //Indicator value for whether ancestor as clicked
  var ancestorClicked = false;
  
  //Scale projecting onto svg domain
  var xScale = d3.scaleLinear()
                 .domain([0, treemapDims.width])
                 .range([margin.left, width - margin.right])
                 .clamp(false);
  var yScale = d3.scaleLinear()
                 .domain([0,treemapDims.height])
                 .range([margin.top, height - margin.bottom])
                 .clamp(false);
  
  
  //Dynamic scale enabling zooming funcitonality
  var parentXScale = d3.scaleLinear().domain([0, treemapDims.width])
                                      .range([margin.left,treemapDims.width - margin.right])
                                      .clamp(false);
  
  var parentYScale = d3.scaleLinear().domain([0, treemapDims.height])
                                     .range([margin.top,treemapDims.height - margin.bottom])
                                     .clamp(false);
  
  //Identity scales for use in ternary operators
  var identityXScale = d3.scaleLinear()
                         .domain(xScale.range())
                         .range(xScale.range())
                         .clamp(false);
  
  var identityYScale = d3.scaleLinear()
                         .domain(yScale.range())
                         .range(yScale.range())
                         .clamp(false);
   
  //Get Offsets for custom treemap cascading
  const yOffset = yScale.invert(yScale.range()[0]+ yScale.range()[1] - yScale(yScale.domain()[1] - offset));
  const xOffset = xScale.invert(xScale.range()[0]+ xScale.range()[1] - xScale(xScale.domain()[1] - offset));

  //Create treemap data
  const root = treemap(data);
  
  //Set up color scale with min, median, max
  const ext = d3.extent(root.descendants(), d => d.value)
  const med = d3.mean(root.descendants(), d => d.value)
  const colorScale = d3.scaleLinear([ext[0],med,ext[1]], ["#ee2656","#f5c512","#4c97d2"]);

  //Transition timing constant
  const tTime = 1000;
    
  function update(current_node){
    // Change parent scale based on current node
    parentXScale
      .domain([d3.min(current_node.children, d => d.x0),d3.max(current_node.children, d => d.x1)])
      .range([(current_node.ancestorX0 + xOffset), current_node.ancestorX0 + treemapDims.width + xOffset]);
    
    parentYScale
      .domain([d3.min(current_node.children, d => d.y0),d3.max(current_node.children, d => d.y1)])
      .range([current_node.ancestorY0 + yOffset,  current_node.ancestorY0 + treemapDims.height + yOffset]);
    
     
    xScale.domain([0, parentXScale.range()[1]])
    yScale.domain([0, parentYScale.range()[1]])
    console.log(xScale.domain());
    //Add Layers
    let layers = svg
      .selectAll(".layer")
      .data(getNestedCloseRelatives(current_node)).join("g").classed("layer",true)
    
    //Remove layers
    layers.exit().remove();
    layers.enter().attr("filter", shadow);
        layers.attr("filter", shadow);
    
    //Create nodes based on data names
    let children = layers.selectAll(".child").data(d => d.values, d => d.ancestors().reverse()
                                                                    .map(x => x.data.name).join("/"));

    //Remove children
    children.exit().transition().duration(tTime)
      .remove();
      
    children.exit()
      .selectAll("*")
      .remove();
    
    // Transition updated node groups
    children.transition()
      .duration(tTime).attr("transform", d => {
          let coords = rectifyDimensions(d);    
          if(d.isAncestor){
            return `translate(${xScale(coords.x0)},${yScale(coords.y0)})`
          }else{   
            return `translate(${xScale(parentXScale(coords.x0))},${yScale(parentYScale(coords.y0))})`
          }
    });
    
    //Add functionality on updated nodes in case of grandchildren
    children.on("click", function(d){
            let newParent = d3.select(this);
            if (d.children){
              handleNewParentClick(newParent);
              update(d);
            }})
        .on("mouseover", function(d) {
          let tempParent = d3.select(this)
          if(!d.children) return;
          handleNewParentMouseOver(tempParent);          
        })
    .on("mouseout",  function(d) {
          let notNewParent = d3.select(this);
          handleNewParentMouseOut(notNewParent)});
    
    //Transition Rectangles
    children.selectAll("rect").transition().delay(function(d){
     if(ancestorClicked) return 0;
     
     return d === current_node || d.depth < current_node.depth ? 0 : tTime;
    
    })      
        .on("end", () => svg.selectAll(".layer").selectAll("*").attr("pointer-events","auto"))
        .attr("width", d => {
                let coords = rectifyDimensions(d);    
                if(d.isAncestor){
                   return (xScale(coords.x1) - xScale(coords.x0));
                }else{   
                  return (xScale(parentXScale(coords.x1)) - xScale(parentXScale(coords.x0)));
                }
            })
        .attr("height", d => {
                let coords = rectifyDimensions(d);    
                if(d.isAncestor){
                   return (yScale(coords.y1) - yScale(coords.y0));
                }else{   
                  return (yScale(parentYScale(coords.y1)) - yScale(parentYScale(coords.y0)));
                }})
        .attr("fill", d => colorScale(d.value));
    
    
    var childrenToAddText = children.filter(function(d){
                                return d3.select(this).select("text").empty();
                            })
    
    childrenToAddText.append("text")
                              .attr("clip-path", d => d.clipUid)
                            .selectAll("tspan")
                            .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)))
                            .join("tspan")
                              .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)                                       .attr("opacity", 0).transition().delay(tTime).attr("opacity", 1)
                            .text(d => d);

      
      
      childrenToAddText.filter(d => d.children).selectAll("tspan")
        .attr("y", 10)
        .attr("dx",3)
        
     childrenToAddText.filter(d => !d.children).selectAll("tspan")
       .attr("y", function(d, i, node){
            return  `${(i === node.length - 1) * 0.3 + 1.1 + i * 0.9}em`;
       }).attr("x", 3)
        
     
          
    
    
    let childrenEnter = children.enter().append("g").classed("child", true)
        .on("click", function(d){
          console.log(d);
            let newParent = d3.select(this);
            console.log(newParent);
            if (d.children){
              handleNewParentClick(newParent);
              update(d);
            }})
        .on("mouseover", function(d) {
          let tempParent = d3.select(this)
          
          if(!d.children){
            return; 
          }
          handleNewParentMouseOver(tempParent);          
        })
    .on("mouseout",  function(d) {
          var notNewParent = d3.select(this);
          notNewParent.transition()
          handleNewParentMouseOut(notNewParent)});
    

    
    childrenEnter.attr("transform", d => {
          let coords = rectifyDimensions(d);    
          console.log(coords)
          console.log(xScale.domain());
          if(d.isAncestor){
            return `translate(${xScale(coords.x0)},${yScale(coords.y0)})`
          }else{   
            return `translate(${xScale(parentXScale(coords.x0))},${yScale(parentYScale(coords.y0))})`
          }
    });
    
    
    childrenEnter.call(Child);
    
    let tempLayer = svg.append("g").attr("id","tempLayer");
    tempLayer = svg.append("g").attr("pointer-events","none");
    
   
  }
  
  function Child(selection){
    selection.append("title")
        .text(d => `${d.ancestors().reverse().map(d => d.data.name).join("/")}\n${format(d.value)}`);

    
     selection.append("rect")
        .attr("id", d => (d.nodeUid = DOM.uid("node")).id)
        .attr("stroke-width", 1)
        .attr("stroke", "white")
        .attr("opacity", 0)
        .attr("fill", d => colorScale(d.value))
       .attr("width", d => {
                let coords = rectifyDimensions(d);    
                if(d.isAncestor){
                   return (xScale(coords.x1) - xScale(coords.x0));
                }else{   
                  return (xScale(parentXScale(coords.x1)) - xScale(parentXScale(coords.x0)));
                }
            })
        .attr("height", d => {
                let coords = rectifyDimensions(d);    
                if(d.isAncestor){
                   return (yScale(coords.y1) - xScale(coords.y0));
                }else{   
                  return (yScale(parentYScale(coords.y1)) - yScale(parentYScale(coords.y0)));
                }
            })
            .transition().duration(tTime).on("interrupt", function(d){
          var selection = d3.select(this);
            selection.attr("fill", d => colorScale(d.value));
                                    
     }).attr("opacity", 1);
    
    selection.append("clipPath")
      .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
      .attr("xlink:href", d => d.nodeUid.href);
    


    selection.append("text")
        .attr("clip-path", d => d.clipUid)
      .selectAll("tspan")
        .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)))
        .join("tspan")
        .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
        .attr("y",10)
        .attr("dx",3)
        .text(d => d)
        .attr("opacity", 0)
        .transition().duration(tTime).attr("opacity", 1);
    
            

  }
       
  
  function grandChild(selection){
       let datum = selection.datum()
     
     let tempLayer =  svg.select("#tempLayer").attr("width", datum.x1 - datum.x0)
                        .attr("height", datum.y1 - datum.y0)
     
     
     let innerNodes =  tempLayer.selectAll('.child')
                              .data(datum.children, function(d){
                                return d.ancestors().reverse().map(x => x.data.name).join("/");

                              
                              
                             }).join("g")
                              .classed("child", true)
                              .attr("transform", d => {
                                return `translate(${xScale(parentXScale(d.x0))},${yScale(parentYScale(d.y0))})`})
                              .attr("pointer-events","none");
   
    
     innerNodes.append("title")
        .text(d => `${d.ancestors().reverse().map(d => d.data.name).join("/")}\n${format(d.value)}`);
    
    innerNodes.append("rect")
        .attr("id", d => (d.nodeUid = DOM.uid("node")).id)
        .attr("fill", d => colorScale(d.value))
        .attr("width", d => xScale(parentXScale(d.x1)) - xScale(parentXScale(d.x0)))
        .attr("height", d => yScale(parentYScale(d.y1)) - yScale(parentYScale(d.y0)))
        .transition().duration(tTime).on("interrupt", function(d){
            var selection = d3.select(this);
            selection.attr("fill-opacity",1)                                    
        })
        .attr("fill-opacity",1).attr("stroke-width", 1)
        .attr("stroke", "white");
    
    innerNodes.append("clipPath")
      .attr("id", d => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
      .attr("xlink:href", d => d.nodeUid.href);
  }
  
  
  function handleNewParentClick(selection){
    ancestorClicked = selection.datum().isAncestor;
    selection.selectAll("rect")
      .attr("stroke",strokeColor)
      .attr("stroke-width", strokeWidth)
    
    let tempLayer = svg.select("#tempLayer");
    tempLayer.attr("id", null)
    tempLayer.classed("layer", true);
  }
  
  function handleNewParentMouseOver(selection){
      selection.select("rect")
      .attr("stroke",activeParentStrokeColor)
      .attr("stroke-width", activeParentStrokeWidth)
    if(selection.datum().isAncestor) return;
    
    selection.call(grandChild);  
 
  }

    function handleNewParentMouseOut(selection){
      selection.select("rect")
        .attr("stroke",strokeColor)
        .attr("stroke-width", strokeWidth)
      
      if(!selection.datum().isAncestor) {
        let tempChildren = svg.select('#tempLayer').selectAll('*');
        tempChildren.interrupt();
        tempChildren.remove();
    };
  }

 
  update(root);

  return svg.node();
}
);
  main.variable(observer("getNestedCloseRelatives")).define("getNestedCloseRelatives", ["d3"], function(d3){return(
function getNestedCloseRelatives(node){

    node.ancestors().forEach(d => d.isAncestor = true);
    let relativesSet = new Set(node.ancestors().reverse());
    
    if(node.children){
      node.children.forEach(d => {
        d.isAncestor = false;
        relativesSet.add(d)
      })};
  
  let depthNest = d3.nest().key(d => d.depth).entries([...relativesSet]);
    
  return depthNest
}
)});
  main.variable(observer("rectifyDimensions")).define("rectifyDimensions", function(){return(
(d) => {
  let x0Temp = d.isAncestor ? d.ancestorX0 : d.x0;
  let y0Temp = d.isAncestor ? d.ancestorY0 : d.y0;
  let x1Temp = d.isAncestor ? d.ancestorX1 : d.x1;
  let y1Temp = d.isAncestor ? d.ancestorY1 : d.y1;

      return {
        x0: x0Temp,
        y0: y0Temp,
        x1: x1Temp,
        y1: y1Temp}
}
)});
  main.variable(observer("data")).define("data", ["d3"], function(d3){return(
d3.json("https://raw.githubusercontent.com/d3/d3-hierarchy/v1.1.8/test/data/flare.json")
)});
  main.variable(observer("treemap")).define("treemap", ["cascade","d3","treemapDims","offset"], function(cascade,d3,treemapDims,offset){return(
data => cascade(
  d3.treemap()
    .size([treemapDims.width, treemapDims.height])
    .paddingTop(treemapDims.paddingTop)
    .paddingInner(0)
    .round(true)
    .tile(d3.treemapResquarify)
  (d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height)),
  offset // treemap.paddingOuter
)
)});
  main.variable(observer("cascade")).define("cascade", ["treemapDims"], function(treemapDims){return(
function cascade(root, offset) {
  
  return root.eachAfter(d => {
    let ancWidth = treemapDims.width;
    let ancHeight = treemapDims.height;
    
    d.ancestorX0 = d.depth * offset;
    d.ancestorY0 = d.depth * offset;
    d.ancestorX1 = d.ancestorX0 + ancWidth;
    d.ancestorY1 = d.ancestorY0 + ancHeight;
    
    d.childMinX = d.ancestorX0 + offset;
    d.childMinY = d.ancestorY0 + offset;
  });
}
)});
  main.variable(observer("offset")).define("offset", function(){return(
15
)});
  main.variable(observer("width")).define("width", function(){return(
975
)});
  main.variable(observer("height")).define("height", function(){return(
800
)});
  main.variable(observer("treemapDims")).define("treemapDims", ["width","height"], function(width,height){return(
{
    width: width/2,
    height: height/2,
    paddingTop: 15
  }
)});
  main.variable(observer("format")).define("format", ["d3"], function(d3){return(
d3.format(",d")
)});
  main.variable(observer("d3")).define("d3", ["require"], function(require){return(
require("d3@5")
)});
  return main;
}
