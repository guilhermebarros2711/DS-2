import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

function getClient(){
  const rawUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  const url=rawUrl.replace(/^http:\/\//i,'https://');
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
  return createClient(url,key,{auth:{persistSession:false}});
}

function normalizeRole(user){
  const raw=String(
    user?.tipo ??
    user?.role ??
    user?.perfil ??
    user?.nivel_acesso ??
    user?.nivel ??
    ''
  ).trim().toLowerCase();

  const adminValues=new Set(['admin','adm','administrador','administradora']);
  const username=String(user?.usuario||'').trim().toLowerCase();

  return adminValues.has(raw)||adminValues.has(username)?'admin':'user';
}

async function findUser(supabase,login){
  let result=await supabase
    .from('usuarios')
    .select('*')
    .eq('usuario',login)
    .limit(1)
    .maybeSingle();

  if(result.error) throw result.error;
  if(result.data) return result.data;

  result=await supabase
    .from('usuarios')
    .select('*')
    .eq('email',login)
    .limit(1)
    .maybeSingle();

  if(result.error) throw result.error;
  return result.data;
}

export async function POST(request){
  try{
    const body=await request.json();
    const login=String(body?.login||'').trim();
    const password=String(body?.password||'');

    if(!login||!password){
      return NextResponse.json({error:'Preencha usuário/e-mail e senha.'},{status:400});
    }

    const supabase=getClient();
    const user=await findUser(supabase,login);

    if(!user||String(user.senha??'')!==password){
      return NextResponse.json({error:'Usuário ou senha incorretos.'},{status:401});
    }

    const role=normalizeRole(user);

    return NextResponse.json({
      user:{
        id:user.id,
        nome:user.nome||user.usuario||'Usuário',
        email:user.email||'',
        usuario:user.usuario||'',
        role
      }
    });
  }catch(error){
    console.error('Login error:',error);
    return NextResponse.json({error:'Não foi possível entrar agora. Tente novamente.'},{status:500});
  }
}
