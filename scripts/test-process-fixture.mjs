import { spawn } from "node:child_process";

const port = Number(process.argv[2]);
const grandchild = spawn(
  process.execPath,
  [
    "-e",
    `const http=require('http');const server=http.createServer((_,res)=>res.end('alive'));server.listen(${port},'127.0.0.1',()=>console.log('READY'));process.on('SIGTERM',()=>{});`,
  ],
  { stdio: ["ignore", "pipe", "inherit"], windowsHide: true },
);
grandchild.stdout.pipe(process.stdout);
process.on("SIGTERM", () => {});
