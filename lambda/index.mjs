import { Memcached } from "@joshbetz/memcached";

// Docs: https://github.com/joshbetz/node-memcached#api
const mc = new Memcached(...process.env["CACHE_ENDPOINT"].split(":").reverse());

export const handler = async (event, context) => {
  // const s = x => JSON.stringify(x, null, 2);
  // console.log(
  //   "ENVIRONMENT:\n", s(process.env), "\n",
  //   "EVENT:\n", s(event), "\n",
  //   "CONTEXT:\n" + s(context)
  // );

  await mc.ready();


  return { statusCode: 200 }
}
