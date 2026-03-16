import axios from 'axios';

async function test() {
  try {
    const response = await axios.post('https://api.cobalt.tools/', {
      url: 'https://youtu.be/bCx6WZGxB4w?si=A3SPxy6kOS3eywDZ',
      isAudioOnly: true,
      aFormat: 'mp3'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    console.log('Success:', response.data);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}

test();
