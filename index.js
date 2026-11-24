import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const response = await fetch( 'Numogram.svg' );
if ( ! response.ok ) throw new Error( 'Numogram.svg could not be loaded' );
const NUMOGRAM_SVG = await response.text();

// SVGLoader doesn't implement url(#...) gradient fills; remap them to a sentinel color
const FADE_SENTINEL = '#FF00FF';
const SANITIZED_SVG = NUMOGRAM_SVG.replace( /fill="url\(#[^)]*\)"/g, `fill="${ FADE_SENTINEL }"` );

let camera, scene, renderer, controls, root, zonesLayer, channelsLayer;

// layer offsets in svg units (before global scaling): zones/digits in front,
// currents in the middle, the channel web behind
const ZONE_Z = 140;
const CHANNEL_Z = - 170;

// the source SVG is black-on-white; render it as light ink to match the dark scene
const INK = 0xe8e6e0;

init();

function init() {

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x050505 );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 2200;
	scene.add( camera );

	const light1 = new THREE.DirectionalLight( 0xffffff, 2.5 );
	light1.position.set( 1, 1, 1 );
	scene.add( light1 );

	const light2 = new THREE.DirectionalLight( 0xffffff, 1.5 );
	light2.position.set( - 1, - 1, 1 );
	scene.add( light2 );

	scene.add( new THREE.AmbientLight( 0xffffff, 0.4 ) );

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

	const fillMaterial = new THREE.MeshPhongMaterial( { color: INK, specular: 0x222222, shininess: 20 } );
	const fadeMaterial = new THREE.MeshPhongMaterial( { color: INK, transparent: true, opacity: 0.35, depthWrite: false } );
	const strokeMaterial = new THREE.MeshPhongMaterial( { color: INK, side: THREE.DoubleSide } );

	for ( const path of data.paths ) {

		const style = path.userData.style;

		// filled paths -> extruded shapes; gradient fills (url(#...)) -> translucent flows
		if ( style.fill !== undefined && style.fill !== 'none' ) {

			const material = style.fill === FADE_SENTINEL ? fadeMaterial : fillMaterial;
			// the channel web is one huge compound path; everything else lives with the zones
			const layer = material === fadeMaterial ? currentsLayer
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
