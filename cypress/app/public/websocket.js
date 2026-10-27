const button = document.querySelector('button');
const socket = new WebSocket(`ws://${location.host}/ws`);
const eventList = document.querySelector('ul');

socket.onopen = () => {
  console.log('Connection to server opened.');
  socket.send('Hello Server!');
};

socket.onmessage = e => {
  const newElement = document.createElement('li');

  newElement.textContent = `message: ${e.data}`;
  eventList.appendChild(newElement);
};

socket.onerror = () => {
  console.log('WebSocket failed.');
};

button.onclick = () => {
  console.log('WebSocket closed');
  socket.close();
};
