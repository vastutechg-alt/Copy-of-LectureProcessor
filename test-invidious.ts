import axios from 'axios';

async function test() {
  try {
    const instancesRes = await axios.get('https://api.invidious.io/instances.json');
    const instances = instancesRes.data.filter((i: any) => i[1].type === 'https');
    
    if (instances.length > 0) {
      const instanceUrl = instances[0][1].uri;
      console.log('Using instance:', instanceUrl);
      
      const videoId = 'bCx6WZGxB4w';
      const videoRes = await axios.get(`${instanceUrl}/api/v1/videos/${videoId}`);
      
      const adaptiveFormats = videoRes.data.adaptiveFormats || [];
      const audioStreams = adaptiveFormats.filter((f: any) => f.type && f.type.includes('audio'));
      
      if (audioStreams.length > 0) {
        console.log('Audio stream URL:', audioStreams[0].url);
      } else {
        console.log('No audio streams found');
      }
    } else {
      console.log('No instances found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
