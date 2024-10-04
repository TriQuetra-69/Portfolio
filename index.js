var box1 = document.querySelector(".box1");
var circle1 = document.querySelector("#cursor");
var box2 = document.querySelector(".box2");
var circle2 = document.querySelector("#cursor2");
var box3 = document.querySelector(".box3");
var circle3 = document.querySelector("#cursor3");
var text = document.querySelector("p");

gsap.to(text,{
    opacity:1,
    y:-30,
    duration:1,
    delay:1,
})

function box1Animation(){
    box1.addEventListener("mousemove",function(e){
        var diff = e.clientY - box1.getBoundingClientRect().top;
        gsap.to(circle1,{
            left:e.clientX,
            top:diff-100,
            duration:1.5,
            ease:"power3.Out"
        })
        
    })
    box1.addEventListener("mouseenter",function(){
        gsap.to(circle1,{
            opacity:1,
            scale:1
        })
        
    })
    box1.addEventListener("mouseleave",function(){
        gsap.to(circle1,{
            opacity:0,
            scale:0,
        })
        
    })
}

box1Animation();

function box2Animation(){
    box2.addEventListener("mousemove",function(e){
        var diff = e.clientY - box2.getBoundingClientRect().top;
        gsap.to(circle2,{
            left:e.clientX,
            top:diff-100,
            duration:1.5,
            ease:"power4.Out"
        })
        
    })
    box2.addEventListener("mouseenter",function(){
        gsap.to(circle2,{
            opacity:1,
            scale:1
        })
        
    })
    box2.addEventListener("mouseleave",function(){
        gsap.to(circle2,{
            opacity:0,
            scale:0,
        })
        
    })
}

box2Animation();

function box3Animation(){
    box3.addEventListener("mousemove",function(e){
        var diff = e.clientY - box3.getBoundingClientRect().top;
        gsap.to(circle3,{
            left:e.clientX,
            top:diff-100,
            duration:1.5,
            ease:"power4.Out"
        })
        
    })
    box3.addEventListener("mouseenter",function(){
        gsap.to(circle3,{
            opacity:1,
            scale:1
        })
        
    })
    box3.addEventListener("mouseleave",function(){
        gsap.to(circle3,{
            opacity:0,
            scale:0,
        })
        
    })
}

box3Animation();