async function test() {
  try {
    const response = await fetch(`https://api.vevioz.com/api/search?q=bCx6WZGxB4w`);
    const data = await response.json();
    console.log(data);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
