async function test() {
  try {
    const videoId = 'bCx6WZGxB4w';
    const response = await fetch(`https://pipedapi.smnz.de/streams/${videoId}`);
    const data = await response.json();
    
    const audioStreams = data.audioStreams;
    if (audioStreams && audioStreams.length > 0) {
      console.log('Success! Audio stream URL:', audioStreams[0].url);
    } else {
      console.log('No audio streams found');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
