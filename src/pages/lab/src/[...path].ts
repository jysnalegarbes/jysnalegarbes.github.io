/*
  Raw source for the effects library: every code file in lab/ is served as
  plain text at /lab/src/<path inside lab>, for the page's View and Copy.
*/
import type { APIRoute, GetStaticPaths } from 'astro';

const sources = import.meta.glob('/lab/**/*.{ts,js,json,astro,css,glsl}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const getStaticPaths = (() =>
  Object.entries(sources).map(([file, body]) => ({
    params: { path: file.replace(/^\/lab\//, '') },
    props: { body },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.body as string, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
