"use strict";

const Global = {
	Gid: -1, //-1 means that no any elements
	objects: Object.create(null),
	stateFlags: {
		isDrawing: false,
		isMoving: false
	},

	init() {
		//get svg-canvas, its height and width
		this.svgCnvs = document.getElementById("canvas-svg");
		this.svgCnvsH = parseInt( this.svgCnvs.getAttribute("height") );
		this.svgCnvsW = parseInt( this.svgCnvs.getAttribute("width") );

		//get X and Y svg-canvas coordinates on the page
		let offset = this.svgCnvs.getBoundingClientRect();
		this.svgCnvsOffsetX = offset.left;
		this.svgCnvsOffsetY = offset.top;

		//field is dom element that will contain svg graphic elements
		this.svgField = document.getElementById("field");

		this.drawGrid();
		this.addHandlers();
	},

	drawGrid() {
		let gridLines = document.getElementById("grid-lines");
		let grid = "";

		for(var x = 10; x < this.svgCnvsW; x += 10) {
			var color = (x % 100 == 0) ? "#999" : "#ccc"
			grid += `<line 
						x1="${x}" 
						y1="0" 
						x2="${x}" 
						y2=${this.svgCnvsH} 
						style="stroke: ${color}; stroke-width: 1px;"
					/>`;
		}

		for(var y = 10; y < this.svgCnvsH; y += 10) {
			var color = (y % 100 == 0) ? "#999" : "#ccc"
			grid += `<line 
						x1="0"
						y1="${y}"
						x2="${this.svgCnvsW}" 
						y2=${y} 
						style="stroke: ${color}; stroke-width: 1px;"
					/>`;
		}

		gridLines.innerHTML += grid;
	},

	addHandlers() {
		//get every element on a select-panel and give them a handler
		document.getElementsByName("elem").forEach((panelElem) => {
			if(this.activeElem === undefined) {
				this.activeElem = panelElem.checked ? panelElem.id : undefined;
			}

			panelElem.onclick = (e) => {
				this.activeElem = e.target.id;
			}
		});

		this.svgCnvs.addEventListener("click", (e) => {
			if(e.which == 1) {
				let newElem; //this will be a new drawed element

				//if drawing mode is already enabled
				if(this.stateFlags.isDrawing == true) {
					let lastElem = this.objects[this.Gid]; //get object of a last drawed element 
					let lastElemEndCoords = {
						/*
							since the svgCnvsOffsetX/Y was subtracted in the last elem's constructor
							and they will be subtracted again, in the new element constructor, 
							we will add them values, to get initial coordinates
						*/
						x: lastElem.endPoint[0] + this.svgCnvsOffsetX, 
						y: lastElem.endPoint[1] + this.svgCnvsOffsetY
					};

					//mark the current elem (that is lastElem) as done, setting it's opacity to 1
					let doneLastElem = document.getElementById(lastElem.id); //get DOM element of a last drawed element
					doneLastElem.style["opacity"] = 1;
					doneLastElem.addEventListener("mouseover", () => {
						if(document.getElementById("control-points") != null) { return }
						lastElem.displayControlPoints(doneLastElem);
					});
					doneLastElem.addEventListener("mouseout", (e) => {
						let ctrlPts = document.getElementById("control-points")
						if(ctrlPts != null && e.relatedTarget.tagName != "circle") {
							ctrlPts.remove();
						}
					});

					//next, creates a new element. this.activeElem is a, selected on #elems_panel, name
					newElem = eval(`new ${this.activeElem}( ${lastElemEndCoords.x}, ${lastElemEndCoords.y} )`);
				} else {
					newElem = eval(`new ${this.activeElem}( ${e.pageX}, ${e.pageY} )`);
					this.stateFlags.isDrawing = true;
				}

				//newElem.id is the Gid value, that was incremented in the element's constructor
				this.objects[ newElem.id ] = newElem;
			}
		});

		this.svgCnvs.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			if(this.Gid == -1) { return; }	//-1 means that no any elements

			document.getElementById(this.Gid).remove();	//remove canceled element from DOM
			delete this.objects[this.Gid]; 				//... and from this.objects
			this.Gid--; 								//decrement Gid, that was incremented in the canceled element
			this.stateFlags.isDrawing = false;

			let exsGuideLine = document.getElementById("guide");
			if( !this.stateFlags.isDrawing && exsGuideLine != null) {
				exsGuideLine.remove();
			}
		});

		this.svgCnvs.addEventListener("mousemove", (e) => {
			if(this.stateFlags.isDrawing) {
				this.objects[this.Gid].setSize(e);
			}
		});

		this.svgCnvs.addEventListener("mouseover", (e) => {
			if(e.relatedTarget != null && e.relatedTarget.tagName == "circle") {
				document.getElementById("control-points").remove();
			}
		});
	},

	setAttributes(elem, attributes) {
		for(let attr in attributes) {
			elem.setAttribute(attr, attributes[attr]);
		}
	}
}

Global.init();




//------------------Elements: start--------------------------
class Wall {
	constructor(...startPoint) {
		this.startPoint = [
			startPoint[0] - Global.svgCnvsOffsetX,
			startPoint[1] - Global.svgCnvsOffsetY
		];
		this.endPoint = this.startPoint;

		this.width = 5;
		this.length = 0;

		this.color = "#000";
		this.id = ++Global.Gid;

		this.addInDOM();
	}

	addInDOM() {
		this.line = document.createElementNS("http://www.w3.org/2000/svg", "line");

		let attributes = {
			id: this.id,
			x1: this.startPoint[0],
			y1: this.startPoint[1],
			x2: this.startPoint[0],
			y2: this.startPoint[1],
			style: `stroke: ${this.color};
					stroke-width: ${this.width};
					stroke-linecap: square; 
					opacity: 0.4`
		};
		Global.setAttributes(this.line, attributes);

		Global.svgField.appendChild(this.line);
	}

	setSize(e) {
		this.endPoint = [
			e.pageX - Global.svgCnvsOffsetX,
			e.pageY - Global.svgCnvsOffsetY
		];

		this.stabilizeAngle(6);
		this.stabilizePoint(10);
		this.calcLength();

		this.line.setAttribute("x2", this.endPoint[0]);
		this.line.setAttribute("y2", this.endPoint[1]);
	}

	stabilizeAngle(deviation) {
		let isStabilizeX = Math.abs( this.startPoint[0] - this.endPoint[0] ) <= deviation;
		let isStabilizeY = Math.abs( this.startPoint[1] - this.endPoint[1] ) <= deviation;

		if(isStabilizeX && !isStabilizeY) {
			this.endPoint[0] = this.startPoint[0]; //vertical stabilization
			this.drawGuideLine(
				this.endPoint[0],	//x1
				0,					//y1
				this.endPoint[0],	//x2
				Global.svgCnvsH		//y2, Global.svgCnvsH is svg-canvas height
			);
		} else if(isStabilizeY && !isStabilizeX) {
			this.endPoint[1] = this.startPoint[1]; //horizontal stabilization
			this.drawGuideLine(
				0,					//x1
				this.endPoint[1],	//y1
				Global.svgCnvsW,	//x2, Global,svgCnvsW is svg-canvas width
				this.endPoint[1]	//y2
			)
		} else {
			let guideLineDOM = document.getElementById("guide"); //if guideLineDOM == null, then guide line is not exist
			if(guideLineDOM != null) {
				guideLineDOM.remove();
			}
		}
	}

	drawGuideLine(...coordinates) {
		let [x1, y1, x2, y2] = coordinates;
		let guideLine = document.createElementNS("http://www.w3.org/2000/svg", "line");

		let guideLineDOM = document.getElementById("guide"); //get guideLine from DOM
		if(guideLineDOM == null) {	//if guideLine doesn't yet exist in DOM, then create one
			guideLine.setAttribute("id", "guide");
			guideLine.setAttribute("x1", x1);
			guideLine.setAttribute("y1", y1);
			guideLine.setAttribute("x2", x2);
			guideLine.setAttribute("y2", y2); //Global.svgCnvsH is height of the svg canvas

			guideLine.style = "stroke-width: 1; stroke: rgba(101, 112, 209)";

			Global.svgField.appendChild(guideLine);
		}
	}

	stabilizePoint(deviation) {
		let objectsQty = Object.keys(Global.objects).length;

		for (var elemId = 0; elemId < objectsQty - 1; elemId++) {
			var startPointConcurrenceX = Math.abs( 
				this.endPoint[0] - Global.objects[elemId].startPoint[0]
			) <= deviation;	

			if(startPointConcurrenceX) {
				var startPointConcurrenceY = Math.abs(
					this.endPoint[1] - Global.objects[elemId].startPoint[1]
				) <= deviation;

				if(startPointConcurrenceY) {
					this.endPoint = Global.objects[elemId].startPoint;
					return;
				}
			}

			var endPointConcurrenceX = Math.abs(
					this.endPoint[0] - Global.objects[elemId].endPoint[0]
			) <= deviation;

			if(endPointConcurrenceX) {
				var endPointConcurrenceY = Math.abs(
					this.endPoint[1] - Global.objects[elemId].endPoint[1]
				) <= deviation;

				if(endPointConcurrenceY) {
					this.endPoint = Global.objects[elemId].endPoint;
					return
				}
			}
		}
	}

	calcLength() {
		this.length = Math.sqrt(
			(this.endPoint[0] - this.startPoint[0]) ** 2 +
			(this.endPoint[1] - this.startPoint[1]) ** 2
		);
	}
	
	displayControlPoints(pointTargetElem) {
		if( Global.stateFlags.isDrawing ) { return; }

		//calculate control points coordinates
		let pointsCoords = {
			start: [this.startPoint[0], this.startPoint[1]],
			end: [this.endPoint[0], this.endPoint[1]],
		};
		pointsCoords.center = [
			//mathematic formula for calculate line center coords
			(pointsCoords.start[0] + pointsCoords.end[0]) / 2,
			(pointsCoords.start[1] + pointsCoords.end[1]) / 2
		];

		//creating svg nodes of control points
		let circlePoints = {
			start: document.createElementNS("http://www.w3.org/2000/svg", "circle"),
			end: document.createElementNS("http://www.w3.org/2000/svg", "circle"),
			center: document.createElementNS("http://www.w3.org/2000/svg", "circle")
		};

		//defile common attributes fol all control points svg nodes
		let commonCircleAttrs = {
			r: "5",
			style: "stroke: rgb(255, 0, 0); stroke-width: 2; fill-opacity: 0"
		};

		//create common grouping container for all control points
		let pointsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		pointsGroup.setAttribute("id", "control-points");

		//assign every control point all needed attributes and add them to the pointsGroup
		for(let circle in circlePoints) {
			circlePoints[circle].setAttribute("cx", pointsCoords[circle][0]);
			circlePoints[circle].setAttribute("cy", pointsCoords[circle][1]);
			circlePoints[circle].setAttribute("id", circle);
			Global.setAttributes(circlePoints[circle], commonCircleAttrs);

			this.controlPointFunctionality( circlePoints[circle], pointTargetElem )

			pointsGroup.appendChild(circlePoints[circle]);
		}

		Global.svgField.appendChild(pointsGroup);
	}

	controlPointFunctionality(ctrlPoint, targetElem) {
		switch(ctrlPoint.id) {
			case "start": {
				ctrlPoint.addEventListener("mousedown", (e) => {
					let initialCoords = [+e.target.getAttribute("cx"), +e.target.getAttribute("cy")];
					console.log( targetElem );
				});
			}
			break;
			case "center": {
				ctrlPoint.addEventListener("mousedown", (e) => {
					let initialPointCoords = [+e.target.getAttribute("cx"), +e.target.getAttribute("cy")];
					let [ coordsDeltaX, coordsDeltaY ] = [0, 0];
					Global.svgCnvs.addEventListener("mousemove", )
				});
			}
			break;
			case "end": {
				ctrlPoint.addEventListener("mousedown", (e) => {
					let initialCoords = [+e.target.getAttribute("cx"), +e.target.getAttribute("cy")];
					
				});
			}
			break;
		}
	}

	movePoint(initCoords, targetPoint) {
		console.log( "moving" );
	}
	changeSize() {}
}

class Window {
	constructor() {
		(() => {
			console.log( this.constructor.name );
		})();
	}
}

class Door {
	constructor() {
		(() => {
			console.log( this.constructor.name );
		})();
	}
}
//------------------Elements: end--------------------------

/*TODO: 
	1. Write every class to individual file. 
	2. Use webpack. 
	+3. Fix bug with not deleting guide lines.
	+4. Fix bug with deleting every previous element on click right mouse button
*/