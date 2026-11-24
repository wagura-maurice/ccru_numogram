import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const response = await fetch( 'Numogram.svg' );
if ( ! response.ok ) throw new Error( 'Numogram.svg could not be loaded' );
const NUMOGRAM_SVG = await response.text();

// SVGLoader doesn't implement url(#...) gradient fills; remap each gradient
// (the five currents, one per syzygy) to its own display color
const CURRENT_COLORS = {
	paint0_linear_15_2: 0xa05cff,
	paint1_linear_15_2: 0x35d0ff,
	paint2_linear_15_2: 0x3aff8f,
	paint3_linear_15_2: 0xff3ea0,
	paint4_linear_15_2: 0xffb020
};

const SANITIZED_SVG = NUMOGRAM_SVG.replace( /fill="url\(#([^)]+)\)"/g,
	( match, id ) => `fill="#${ ( CURRENT_COLORS[ id ] || 0x888888 ).toString( 16 ).padStart( 6, '0' ) }"` );

let camera, scene, renderer, controls, root, zonesLayer, channelsLayer;

// layer offsets in svg units (before global scaling): zones/digits in front,
// currents in the middle, the channel web behind
const ZONE_Z = 140;
const CHANNEL_Z = - 170;

// the source SVG is black-on-white; recolor it for the dark scene
const INK = 0xf2e4c9;      // zones, digits, arrowheads - warm ivory
const CHANNEL = 0x6f4dff;  // the gate/channel web - violet
const RING = 0xff4fa3;     // syzygy circle strokes - pink

init();

function init() {

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x0a0812 );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 2200;
	scene.add( camera );

	const light1 = new THREE.DirectionalLight( 0xffffff, 2.5 );
	light1.position.set( 1, 1, 1 );
	scene.add( light1 );

	const light2 = new THREE.DirectionalLight( 0xffffff, 1.5 );
	light2.position.set( - 1, - 1, 1 );
	scene.add( light2 );

	scene.add( new THREE.AmbientLight( 0xffffff, 0.55 ) );

	root = new THREE.Group();
	scene.add( root );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	document.getElementById( 'container' ).appendChild( renderer.domElement );

	controls = new TrackballControls( camera, renderer.domElement );
	controls.minDistance = 600;
	controls.maxDistance = 5000;

	loadNumogram();

	window.addEventListener( 'resize', onWindowResize );

}

function loadNumogram() {

	const data = new SVGLoader().parse( SANITIZED_SVG );

	const svg = new THREE.Group();
	zonesLayer = new THREE.Group();
	const currentsLayer = new THREE.Group();
	channelsLayer = new THREE.Group();
	svg.add( zonesLayer, currentsLayer, channelsLayer );

	const extrudeSettings = {
		depth: 80,
		bevelEnabled: true,
		bevelThickness: 5,
		bevelSize: 3,
		bevelSegments: 2
	};

	const fillMaterial = new THREE.MeshPhongMaterial( { color: INK, emissive: 0x201505, specular: 0x222222, shininess: 20 } );
	const channelMaterial = new THREE.MeshPhongMaterial( { color: CHANNEL, emissive: 0x160a3a, specular: 0x222222, shininess: 20 } );
	const strokeMaterial = new THREE.MeshPhongMaterial( { color: RING, emissive: 0x330d20, side: THREE.DoubleSide } );
	const flowMaterials = new Map();

	function flowMaterial( hex ) {

		let material = flowMaterials.get( hex );
		if ( ! material ) {

			material = new THREE.MeshPhongMaterial( {
				color: hex,
				emissive: new THREE.Color( hex ).multiplyScalar( 0.3 ),
				transparent: true,
				opacity: 0.55,
				depthWrite: false
			} );
			flowMaterials.set( hex, material );

		}
		return material;

	}

	for ( const path of data.paths ) {

		const style = path.userData.style;

		// filled paths -> extruded shapes; gradient fills (url(#...)) -> translucent flows
		if ( style.fill !== undefined && style.fill !== 'none' ) {

			const isFlow = style.fill !== 'black';
			// the channel web is one huge compound path; everything else lives with the zones
			const material = isFlow ? flowMaterial( style.fill )
				: ( path.subPaths.length > 10 ? channelMaterial : fillMaterial );
			const layer = isFlow ? currentsLayer
				: ( path.subPaths.length > 10 ? channelsLayer : zonesLayer );

			for ( const shape of SVGLoader.createShapes( path ) ) {

				const geometry = new THREE.ExtrudeGeometry( shape, extrudeSettings );
				layer.add( new THREE.Mesh( geometry, material ) );

			}

		}

		// stroked paths -> flat ribbons
		if ( style.stroke !== undefined && style.stroke !== 'none' ) {

			for ( const subPath of path.subPaths ) {

				const geometry = SVGLoader.pointsToStroke( subPath.getPoints(), style );
				if ( geometry ) zonesLayer.add( new THREE.Mesh( geometry, strokeMaterial ) );

			}

		}

	}

	zonesLayer.position.z = ZONE_Z;
	channelsLayer.position.z = CHANNEL_Z;

	// scale to a fixed size, flip Y (SVG's y-axis points down), center on origin

	const box = new THREE.Box3().setFromObject( svg );
	const size = box.getSize( new THREE.Vector3() );
	const center = box.getCenter( new THREE.Vector3() );

	const scale = 1200 / Math.max( size.x, size.y );
	svg.scale.set( scale, - scale, scale );
	svg.position.set( - center.x * scale, center.y * scale, - center.z * scale );

	root.add( svg );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();

	const time = Date.now() * 0.001;

	const breathe = 1 + Math.sin( time * 0.6 ) * 0.12;
	zonesLayer.position.z = ZONE_Z * breathe;
	channelsLayer.position.z = CHANNEL_Z * breathe;

	root.rotation.y = Math.sin( time * 0.4 ) * 0.38;
	root.rotation.x = Math.sin( time * 0.27 ) * 0.08;

	renderer.render( scene, camera );

}
