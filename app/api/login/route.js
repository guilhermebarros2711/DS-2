import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

function getClient(){
  const rawUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  const url=rawUrl.replace(/^http:\/\//i,'https://');
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
  return createClient(url,key,{auth:{persistSession:false}});
}

function displayName(value){
  return String(value||'Usuário')
    .replace(/[._-]+/g,' ')
    .replace(/\b\w/g,letter=>letter.toUpperCase())
    .trim()||'Usuário';
}

async function resolveDemoUser(supabase,email){
  const localPart=email.split('@')[0];

  let result=await supabase
    .from('usuarios')
    .select('id,nome,email,usuario')
    .eq('email',email)
    .limit(1)
    .maybeSingle();

  if(result.error) throw result.error;
  if(result.data) return result.data;

  result=await supabase
    .from('usuarios')
    .select('id,nome,email,usuario')
    .eq('usuario',localPart)
    .limit(1)
    .maybeSingle();

  if(result.error) throw result.error;
  if(result.data) return result.data;

  result=await supabase
    .from('usuarios')
    .select('id,nome,email,usuario')
    .order('id',{ascending:true})
    .limit(1)
    .maybeSingle();

  if(result.error) throw result.error;
  return result.data;
}

export async function POST(request){
  try{
    const body=await request.json();
    const email=String(body?.login||'').trim().toLowerCase();
    const password=String(body?.password||'');

    if(!email||!password){
      return NextResponse.json({error:'Preencha o e-mail e a senha.'},{status:400});
    }

    if(!email.includes('@')){
      return NextResponse.json({
        error:'Use um e-mail: @gmail.com para administrador ou @email.com para usuário.'
      },{status:400});
    }

    if(email.endsWith('@gmail.com')){
      const localPart=email.split('@')[0];
      return NextResponse.json({
        user:{
          id:null,
          nome:displayName(localPart),
          email,
          usuario:localPart,
          role:'admin',
          demo:true
        }
      });
    }

    if(email.endsWith('@email.com')){
      const supabase=getClient();
      const dbUser=await resolveDemoUser(supabase,email);
      const localPart=email.split('@')[0];

      return NextResponse.json({
        user:{
          id:dbUser?.id??null,
          nome:dbUser?.nome||displayName(localPart),
          email,
          usuario:dbUser?.usuario||localPart,
          role:'user',
          demo:true
        }
      });
    }

    return NextResponse.json({
      error:'Domínio inválido. Use @gmail.com para administrador ou @email.com para usuário.'
    },{status:401});
  }catch(error){
    console.error('Login error:',error);
    return NextResponse.json({error:'Não foi possível entrar agora. Tente novamente.'},{status:500});
  }
}
