const url = 'https://docs.google.com/spreadsheets/d/15mP3CzQ6M9irA8XTj1I3k2FeIwzpzU6HNxsrUsHwiTA/export?format=csv&gid=0';

async function test() {
  const res = await fetch(url);
  const text = await res.text();
  console.log(text.split('\n')[0]);
}

test();
