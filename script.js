function getRandomColor() {
  var letters="1234567890ABCDEF"
  var color="#"
  for (var i=0; i<6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)]
  }
return color
}

color1 = getRandomColor()
color2 = getRandomColor()
color3 = getRandomColor()
color4 = getRandomColor()
color5 = getRandomColor()
color6 = getRandomColor()
color7 = getRandomColor()
color8 = getRandomColor()
color9 = getRandomColor()
var colors = [color1, color2, color3, color4, color5, color6, color7, color8, color9]
document.getElementById("0").style.background = color1
document.getElementById("1").style.background = color2
document.getElementById("2").style.background = color3
document.getElementById("3").style.background = color4
document.getElementById("4").style.background = color5
document.getElementById("5").style.background = color6
document.getElementById("6").style.background = color7
document.getElementById("7").style.background = color8
document.getElementById("8").style.background = color9
// console.log(colors)
// logs colors, for debugging

var index =  Math.floor(Math.random()*colors.length)
var message = "Guess which button is" + colors[index]
document.getElementById("prompt").innerHTML = message

function verify(guess) {
  if (guess == index) {
    alert("correct")
      document.getElementById("prompt").style.background = "green";
  }else 
  {
    alert("incorrect")
      document.getElementById("prompt").style.background = "red";
  }
}
color = "black"
function ColorPicker(input) {
  color = input.value;
}
function changeColor(pixel) {
  pixel.style.background = color;
}
  