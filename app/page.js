'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';
import {
  BookOpen,Users,BookCopy,CalendarClock,TriangleAlert,Star,Tags,Building2,Boxes,History,
  LayoutDashboard,Search,RefreshCw,Plus,Pencil,Trash2,X,ArrowUpRight,Clock3,LibraryBig,
  CheckCircle2,CircleDollarSign,Sparkles,Eye,EyeOff,LogOut,ShieldCheck,UserRound,
  LockKeyhole,AtSign
} from 'lucide-react';

const navGroups=[
  {label:'Visão geral',items:[['Dashboard','dashboard',LayoutDashboard]]},
  {label:'Circulação',items:[
    ['Empréstimos','emprestimos',BookCopy],
    ['Reservas','reservas',CalendarClock],
    ['Multas','multas',TriangleAlert]
  ]},
  {label:'Acervo',items:[
    ['Livros','livros',BookOpen],
    ['Exemplares','exemplares',Boxes],
    ['Categorias','categorias',Tags],
    ['Editoras','editoras',Building2]
  ]},
  {label:'Pessoas e atividade',items:[
    ['Usuários','usuarios',Users],
    ['Avaliações','avaliacoes',Star],
    ['Histórico','historico_acoes',History]
  ]}
];

const sections=navGroups.flatMap(group=>group.items);

const labels={
  id:'ID',nome:'Nome',titulo:'Título',autor:'Autor',quantidade:'Qtd.',preco:'Preço',
  email:'E-mail',usuario:'Usuário',status:'Status',nota:'Nota',valor:'Valor',
  motivo:'Motivo',acao:'Ação',entidade:'Entidade',comentario:'Comentário',pais:'País',
  id_categoria:'Categoria',id_editora:'Editora',id_usuario:'Usuário',
  id_livro:'Livro',id_exemplar:'Exemplar',numero_patrimonio:'Patrimônio',
  estado_conservacao:'Conservação',localizacao:'Localização',
  data_emprestimo:'Empréstimo',data_devolucao:'Devolução',
  data_prevista_devolucao:'Prev. devolução',data_reserva:'Reserva',
  data_expiracao:'Expiração',data_multa:'Data',data_pagamento:'Pagamento',
  data_avaliacao:'Data',data_acao:'Data'
};

const dateFields=new Set([
  'data_emprestimo','data_devolucao','data_prevista_devolucao','data_reserva',
  'data_expiracao','data_multa','data_pagamento','data_avaliacao','data_acao',
  'created_at','updated_at'
]);

const currencyFields=new Set(['preco','valor']);

function normalizeStatus(status=''){
  return String(status).trim().toLowerCase();
}

function isLoanReturned(loan){
  const status=normalizeStatus(loan?.status);
  return Boolean(loan?.data_devolucao)||['devolvido','finalizado'].includes(status);
}

function isLoanOverdue(loan){
  if(isLoanReturned(loan)) return false;
  if(normalizeStatus(loan?.status)==='atrasado') return true;
  const due=loan?.data_prevista_devolucao;
  if(!due) return false;
  const today=new Date();
  const localToday=[
    today.getFullYear(),
    String(today.getMonth()+1).padStart(2,'0'),
    String(today.getDate()).padStart(2,'0')
  ].join('-');
  return String(due).slice(0,10)<localToday;
}

function localIsoDate(date=new Date()){
  return [
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')
  ].join('-');
}

function addDaysIso(days){
  const date=new Date();
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()+days);
  return localIsoDate(date);
}

function statusClass(status=''){
  const s=normalizeStatus(status);
  if(['atrasado','pendente','não pago','nao pago','vencido','cancelado'].some(x=>s.includes(x))) return 'danger';
  if(['devolvido','finalizado','pago','concluido','concluído','disponivel','disponível'].some(x=>s.includes(x))) return 'success';
  if(['ativo','emprestado','reservado','em andamento','aberto'].some(x=>s.includes(x))) return 'info';
  return 'neutral';
}

function formatDate(value){
  if(!value) return '—';
  const raw=String(value);
  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)){
    const [year,month,day]=raw.split('-');
    return day+'/'+month+'/'+year;
  }
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(date);
}

function formatMoney(value){
  const n=Number(value);
  if(Number.isNaN(n)) return String(value??'—');
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
}

function relationLabel(key,value,data){
  if(value==null) return '—';
  const id=Number(value);
  if(key==='id_usuario'){
    const item=(data.usuarios||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || item.usuario || '#'+value : '#'+value;
  }
  if(key==='id_livro'){
    const item=(data.livros||[]).find(x=>Number(x.id)===id);
    return item ? item.titulo || '#'+value : '#'+value;
  }
  if(key==='id_categoria'){
    const item=(data.categorias||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || '#'+value : '#'+value;
  }
  if(key==='id_editora'){
    const item=(data.editoras||[]).find(x=>Number(x.id)===id);
    return item ? item.nome || '#'+value : '#'+value;
  }
  if(key==='id_exemplar'){
    const item=(data.exemplares||[]).find(x=>Number(x.id)===id);
    return item ? item.numero_patrimonio || '#'+value : '#'+value;
  }
  return null;
}

function displayValue(key,value,data){
  const relation=relationLabel(key,value,data);
  if(relation!==null) return relation;
  if(dateFields.has(key)) return formatDate(value);
  if(currencyFields.has(key)) return formatMoney(value);
  if(value==null||value==='') return '—';
  if(typeof value==='boolean') return value?'Sim':'Não';
  if(typeof value==='object') return JSON.stringify(value);
  return String(value);
}

export default function Home(){
  const [tab,setTab]=useState('dashboard');
  const [data,setData]=useState({});
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState('');
  const [notice,setNotice]=useState('');
  const [loanFilter,setLoanFilter]=useState('todos');
  const [loanUser,setLoanUser]=useState('');
  const [session,setSession]=useState(null);
  const [authReady,setAuthReady]=useState(false);

  const isAdmin=session?.role==='admin';
  const visibleNavGroups=useMemo(()=>{
    if(isAdmin) return navGroups;
    const allowed=new Set(['dashboard','livros','emprestimos','reservas','avaliacoes']);
    return navGroups
      .map(group=>({...group,items:group.items.filter(item=>allowed.has(item[1]))}))
      .filter(group=>group.items.length);
  },[isAdmin]);

  async function load(){
    if(!session) return;
    setLoading(true);

    const names=isAdmin
      ?sections.slice(1).map(x=>x[1])
      :['livros','emprestimos','reservas','multas','avaliacoes','categorias','editoras','exemplares','usuarios'];

    const res=await Promise.all(names.map(async table=>{
      let query=table==='usuarios'
        ?supabase.from(table).select('id,nome,email,usuario')
        :supabase.from(table).select('*');

      if(!isAdmin){
        if(table==='usuarios') query=query.eq('id',session.id);
        if(['emprestimos','reservas','multas','avaliacoes'].includes(table)){
          query=query.eq('id_usuario',session.id);
        }
      }

      const{data,error}=await query.order('id',{ascending:true}).limit(250);
      return[table,data||[],error];
    }));

    setData(Object.fromEntries(res.map(([table,rows])=>[table,rows])));
    setLoading(false);
  }

  useEffect(()=>{
    try{
      const saved=localStorage.getItem('biblioteca_session');
      if(saved) setSession(JSON.parse(saved));
    }catch{}
    setAuthReady(true);
  },[]);

  useEffect(()=>{
    if(authReady&&session) load();
  },[authReady,session?.id,session?.role]);

  function handleLogin(user){
    localStorage.setItem('biblioteca_session',JSON.stringify(user));
    setSession(user);
    setTab('dashboard');
    setQ('');
    setNotice('');
  }

  function logout(){
    localStorage.removeItem('biblioteca_session');
    setSession(null);
    setData({});
    setTab('dashboard');
    setQ('');
    setNotice('');
  }

  const rows=data[tab]||[];
  const filtered=rows.filter(row=>{
    if(tab==='emprestimos'){
      const returned=isLoanReturned(row);
      if(loanFilter==='abertos'&&returned) return false;
      if(loanFilter==='devolvidos'&&!returned) return false;
      if(loanFilter==='atrasados'&&!isLoanOverdue(row)) return false;
      if(loanUser&&String(row.id_usuario)!==String(loanUser)) return false;
    }
    const raw=JSON.stringify(row).toLowerCase();
    const readable=Object.entries(row)
      .map(([key,val])=>displayValue(key,val,data))
      .join(' ')
      .toLowerCase();
    return (raw+' '+readable).includes(q.toLowerCase());
  });
  const loans=data.emprestimos||[];
  const active=loans.filter(x=>!isLoanReturned(x)).length;
  const overdue=loans.filter(isLoanOverdue).length;
  const pending=(data.multas||[]).filter(x=>!['paga','pago'].includes(normalizeStatus(x.status))).length;
  const editable=isAdmin&&(tab==='livros'||tab==='usuarios');

  const recentLoans=useMemo(()=>[...(data.emprestimos||[])]
    .sort((a,b)=>Number(b.id||0)-Number(a.id||0))
    .slice(0,5),[data.emprestimos]);

  const totalCopies=(data.exemplares||[]).length;
  const availableCopies=(data.exemplares||[]).filter(x=>['disponivel','disponível'].includes(normalizeStatus(x.status))).length;
  const activeReservations=(data.reservas||[]).filter(x=>!['cancelada','cancelado','finalizada','finalizado','expirada','expirado'].includes(normalizeStatus(x.status))).length;

  function openNew(){
    if(!isAdmin) return;
    setFormError('');
    if(tab==='livros'){
      setForm({titulo:'',autor:'',quantidade:'1',preco:'',id_categoria:'',id_editora:''});
    }else if(tab==='usuarios'){
      setForm({nome:'',email:'',usuario:'',senha:''});
    }else if(tab==='emprestimos'){
      setForm({id_usuario:'',id_livro:''});
    }else{
      return;
    }
    setModal({table:tab,mode:'new'});
  }

  function openEdit(row){
    if(!isAdmin) return;
    setFormError('');
    if(tab==='livros'){
      setForm({
        titulo:row.titulo??'',
        autor:row.autor??'',
        quantidade:String(row.quantidade??0),
        preco:String(row.preco??''),
        id_categoria:row.id_categoria==null?'':String(row.id_categoria),
        id_editora:row.id_editora==null?'':String(row.id_editora)
      });
    }else{
      setForm({nome:row.nome??'',email:row.email??'',usuario:row.usuario??'',senha:''});
    }
    setModal({table:tab,mode:'edit',id:row.id});
  }

  async function save(e){
    e.preventDefault();
    if(!isAdmin) return;
    setSaving(true);
    setFormError('');

    if(modal.table==='emprestimos'){
      const idUsuario=Number(form.id_usuario);
      const idLivro=Number(form.id_livro);
      if(!idUsuario||!idLivro){
        setFormError('Escolha o usuário e o livro.');
        setSaving(false);
        return;
      }

      const book=(data.livros||[]).find(x=>Number(x.id)===idLivro);
      if(!book){
        setFormError('Livro não encontrado.');
        setSaving(false);
        return;
      }
      const quantity=Number(book.quantidade||0);
      if(quantity<=0){
        setFormError('Esse livro está sem unidades disponíveis.');
        setSaving(false);
        return;
      }

      const payload={
        id_usuario:idUsuario,
        id_livro:idLivro,
        data_emprestimo:localIsoDate(),
        data_prevista_devolucao:addDaysIso(14),
        status:'emprestado',
        data_devolucao:null,
        id_exemplar:null
      };

      const{data:created,error:loanError}=await supabase
        .from('emprestimos')
        .insert(payload)
        .select('id')
        .single();

      if(loanError){
        setFormError('Não foi possível registrar o empréstimo: '+loanError.message);
        setSaving(false);
        return;
      }

      const{error:stockError}=await supabase
        .from('livros')
        .update({quantidade:quantity-1})
        .eq('id',idLivro);

      if(stockError){
        if(created?.id) await supabase.from('emprestimos').delete().eq('id',created.id);
        setFormError('O empréstimo não foi concluído porque o estoque não pôde ser atualizado.');
        setSaving(false);
        return;
      }

      setModal(null);
      setSaving(false);
      setNotice('Empréstimo registrado. Devolução prevista para '+formatDate(payload.data_prevista_devolucao)+'.');
      await load();
      setTimeout(()=>setNotice(''),4200);
      return;
    }

    let payload;
    if(modal.table==='livros'){
      if(!form.titulo?.trim()||!form.autor?.trim()||form.preco===''){
        setFormError('Preencha título, autor e preço.');
        setSaving(false);
        return;
      }
      payload={
        titulo:form.titulo.trim(),
        autor:form.autor.trim(),
        quantidade:Number(form.quantidade||0),
        preco:Number(form.preco),
        id_categoria:form.id_categoria?Number(form.id_categoria):null,
        id_editora:form.id_editora?Number(form.id_editora):null
      };
    }else{
      if(!form.nome?.trim()||!form.email?.trim()||!form.usuario?.trim()||(modal.mode==='new'&&!form.senha)){
        setFormError('Preencha nome, e-mail, usuário e senha.');
        setSaving(false);
        return;
      }
      payload={
        nome:form.nome.trim(),
        email:form.email.trim(),
        usuario:form.usuario.trim()
      };
      if(form.senha) payload.senha=form.senha;
    }

    const query=modal.mode==='new'
      ?supabase.from(modal.table).insert(payload)
      :supabase.from(modal.table).update(payload).eq('id',modal.id);

    const{error}=await query;
    if(error){
      setFormError('Não foi possível salvar: '+error.message);
      setSaving(false);
      return;
    }

    setModal(null);
    setSaving(false);
    setNotice(modal.table==='livros'?'Livro salvo com sucesso.':'Usuário salvo com sucesso.');
    await load();
    setTimeout(()=>setNotice(''),2500);
  }

  async function returnLoan(row){
    if(!isAdmin||isLoanReturned(row)) return;

    const user=relationLabel('id_usuario',row.id_usuario,data);
    const book=relationLabel('id_livro',row.id_livro,data);
    if(!confirm('Registrar a devolução de "'+book+'" por '+user+'?')) return;

    setSaving(true);
    const previousStatus=row.status;
    const previousReturn=row.data_devolucao??null;

    const{error:loanError}=await supabase
      .from('emprestimos')
      .update({status:'devolvido',data_devolucao:localIsoDate()})
      .eq('id',row.id);

    if(loanError){
      setSaving(false);
      setNotice('Não foi possível registrar a devolução: '+loanError.message);
      setTimeout(()=>setNotice(''),4500);
      return;
    }

    let bookId=row.id_livro;
    if(bookId==null&&row.id_exemplar!=null){
      const copy=(data.exemplares||[]).find(x=>Number(x.id)===Number(row.id_exemplar));
      bookId=copy?.id_livro??null;
    }

    if(bookId!=null){
      const{data:bookRow,error:readError}=await supabase
        .from('livros')
        .select('quantidade')
        .eq('id',bookId)
        .single();

      if(readError||!bookRow){
        await supabase.from('emprestimos').update({
          status:previousStatus,
          data_devolucao:previousReturn
        }).eq('id',row.id);
        setSaving(false);
        setNotice('A devolução foi cancelada porque não foi possível consultar o estoque do livro.');
        setTimeout(()=>setNotice(''),4500);
        return;
      }

      const{error:stockError}=await supabase
        .from('livros')
        .update({quantidade:Number(bookRow.quantidade||0)+1})
        .eq('id',bookId);

      if(stockError){
        await supabase.from('emprestimos').update({
          status:previousStatus,
          data_devolucao:previousReturn
        }).eq('id',row.id);
        setSaving(false);
        setNotice('A devolução foi cancelada porque o estoque não pôde ser atualizado.');
        setTimeout(()=>setNotice(''),4500);
        return;
      }
    }

    setSaving(false);
    setNotice('Devolução registrada com sucesso.');
    await load();
    setTimeout(()=>setNotice(''),3000);
  }

  async function remove(row){
    if(!isAdmin) return;
    const item=tab==='livros'?row.titulo:row.nome;
    if(!confirm('Excluir "'+item+'"? Essa ação não pode ser desfeita.')) return;
    const{error}=await supabase.from(tab).delete().eq('id',row.id);
    if(error){
      setNotice('Não foi possível excluir: '+error.message);
      setTimeout(()=>setNotice(''),4500);
      return;
    }
    setNotice(tab==='livros'?'Livro excluído.':'Usuário excluído.');
    await load();
    setTimeout(()=>setNotice(''),2500);
  }

  function selectTab(key){
    if(!isAdmin&&!['dashboard','livros','emprestimos','reservas','avaliacoes'].includes(key)) return;
    setTab(key);
    setQ('');
    setNotice('');
  }

  if(!authReady){
    return <div className="auth-loading"><div className="auth-loading-mark"><BookOpen size={25}/></div></div>;
  }

  if(!session){
    return <LoginScreen onLogin={handleLogin}/>;
  }

  return <main>
    <aside>
      <div className="brand">
        <div className="logo"><BookOpen size={23}/><span>DS</span></div>
        <div><b>Biblioteca DS</b><span>2º DS • ETEC</span></div>
      </div>

      <nav>
        {visibleNavGroups.map(group=><div className="nav-group" key={group.label}>
          <span className="nav-label">{group.label}</span>
          {group.items.map(([name,key,Icon])=>
            <button key={key} className={tab===key?'active':''} onClick={()=>selectTab(key)}>
              <Icon size={18}/><em>{name}</em>
            </button>
          )}
        </div>)}
      </nav>

      <div className="foot">
        <span className="connection-dot"></span> Supabase conectado
        <small>Next.js • Vercel</small>
      </div>
    </aside>

    <section className="content">
      <div className="mobile-brand">
        <div className="mobile-logo"><BookOpen size={18}/><span>DS</span></div>
        <div><strong>Biblioteca DS</strong><span>2º DS • ETEC</span></div>
      </div>

      <header>
        <div>
          <p>{isAdmin?'Sistema de gerenciamento':'Área do usuário'}</p>
          <h1>{sections.find(x=>x[1]===tab)?.[0]}</h1>
        </div>
        <div className="header-actions">
          <button className="refresh" onClick={load} disabled={loading}>
            <RefreshCw size={17} className={loading?'spin':''}/>{loading?'Atualizando':'Atualizar'}
          </button>
          <div className="account-chip">
            <div className={'account-avatar '+(isAdmin?'admin':'')}>
              {isAdmin?<ShieldCheck size={17}/>:<UserRound size={17}/>}
            </div>
            <div className="account-copy">
              <strong>{session.nome}</strong>
              <span>{isAdmin?'Administrador':'Usuário'}</span>
            </div>
            <button className="logout-btn" onClick={logout} title="Sair" aria-label="Sair">
              <LogOut size={16}/>
            </button>
          </div>
        </div>
      </header>

      {notice&&<div className="notice"><CheckCircle2 size={17}/>{notice}</div>}

      {tab==='dashboard'?<>
        <div className="hero">
          <div>
            <span className="eyebrow"><Sparkles size={13}/> VISÃO GERAL</span>
            <h2>{isAdmin?'Biblioteca DS':'Olá, '+String(session.nome||'Usuário').split(' ')[0]}</h2>
            <p>{isAdmin?'Acervo, circulação e usuários organizados em um só lugar.':'Acompanhe seus empréstimos, reservas e avaliações em um só lugar.'}</p>
            <button className="hero-action" onClick={()=>selectTab('emprestimos')}>
              Ver empréstimos <ArrowUpRight size={16}/>
            </button>
          </div>
          <div className="hero-mark"><BookOpen size={74}/><b>DS</b></div>
        </div>

        <div className="cards">
          <Card t="Livros cadastrados" v={(data.livros||[]).length} I={BookOpen} tone="blue"/>
          {isAdmin&&<Card t="Usuários" v={(data.usuarios||[]).length} I={Users} tone="violet"/>}
          <Card t={isAdmin?'Empréstimos ativos':'Meus empréstimos'} v={active} I={BookCopy} tone="cyan"/>
          <Card t="Atrasados" v={overdue} I={TriangleAlert} tone={overdue?'red':'green'}/>
          <Card t={isAdmin?'Reservas ativas':'Minhas reservas'} v={activeReservations} I={CalendarClock} tone="amber"/>
          <Card t={isAdmin?'Multas pendentes':'Minhas multas'} v={pending} I={CircleDollarSign} tone={pending?'red':'green'}/>
        </div>

        <div className="dashboard-grid">
          <div className="panel activity-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">MOVIMENTAÇÃO</span><h3>{isAdmin?'Empréstimos recentes':'Meus empréstimos recentes'}</h3></div>
              <button className="text-button" onClick={()=>selectTab('emprestimos')}>Ver todos <ArrowUpRight size={15}/></button>
            </div>
            {recentLoans.length?<div className="activity-list">
              {recentLoans.map((loan,i)=><LoanRow key={loan.id??i} loan={loan} data={data}/>)}
            </div>:<EmptyState compact text="Nenhum empréstimo registrado ainda."/>}
          </div>

          <div className="panel circulation-panel">
            <div className="panel-head">
              <div><span className="panel-kicker">RESUMO</span><h3>{isAdmin?'Situação da circulação':'Minha situação'}</h3></div>
              <LibraryBig size={21}/>
            </div>
            {isAdmin?<>
              <MetricRow label="Exemplares cadastrados" value={totalCopies} icon={Boxes}/>
              <MetricRow label="Exemplares disponíveis" value={availableCopies} icon={BookOpen}/>
              <MetricRow label="Empréstimos em aberto" value={active} icon={Clock3}/>
              <MetricRow label="Pendências financeiras" value={pending} icon={CircleDollarSign}/>
            </>:<>
              <MetricRow label="Empréstimos em aberto" value={active} icon={Clock3}/>
              <MetricRow label="Empréstimos atrasados" value={overdue} icon={TriangleAlert}/>
              <MetricRow label="Reservas ativas" value={activeReservations} icon={CalendarClock}/>
              <MetricRow label="Pendências financeiras" value={pending} icon={CircleDollarSign}/>
            </>}
          </div>
        </div>
      </>:<div className="panel">
        <div className="toolbar">
          <div>
            <span className="panel-kicker">BANCO DE DADOS</span>
            <h3>{sections.find(x=>x[1]===tab)?.[0]}</h3>
            <span>{filtered.length} {filtered.length===1?'registro':'registros'}</span>
          </div>
          <div className="toolbar-actions">
            <label><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={'Pesquisar em '+(sections.find(x=>x[1]===tab)?.[0]||'registros').toLowerCase()+'...'}/></label>
            {tab==='emprestimos'&&<>
              <select className="toolbar-select" value={loanFilter} onChange={e=>setLoanFilter(e.target.value)} aria-label="Filtrar empréstimos">
                <option value="todos">Todos</option>
                <option value="abertos">Em aberto</option>
                <option value="devolvidos">Devolvidos</option>
                <option value="atrasados">Atrasados</option>
              </select>
              {isAdmin&&<select className="toolbar-select user-filter" value={loanUser} onChange={e=>setLoanUser(e.target.value)} aria-label="Filtrar por usuário">
                <option value="">Todos os usuários</option>
                {(data.usuarios||[]).map(user=><option key={user.id} value={user.id}>{user.nome||user.usuario}</option>)}
              </select>}
            </>}
            {isAdmin&&(editable||tab==='emprestimos')&&<button className="primary" onClick={openNew}><Plus size={18}/>{tab==='livros'?'Novo livro':tab==='usuarios'?'Novo usuário':'Novo empréstimo'}</button>}
          </div>
        </div>

        {loading?<EmptyState loading text="Carregando dados..."/>:filtered.length?
          <Table table={tab} rows={filtered} data={data} editable={editable} canReturn={isAdmin} onEdit={openEdit} onDelete={remove} onReturn={returnLoan} saving={saving}/>
          :<EmptyState text={q?'Nenhum resultado para essa busca.':'Nenhum registro encontrado.'}/>}
      </div>}

      {modal&&<EditorModal
        modal={modal}
        form={form}
        setForm={setForm}
        categories={data.categorias||[]}
        publishers={data.editoras||[]}
        users={data.usuarios||[]}
        books={data.livros||[]}
        saving={saving}
        error={formError}
        onClose={()=>setModal(null)}
        onSave={save}
      />}
    </section>
  </main>;
}

function Card({t,v,I,tone='blue'}){
  return <div className={'card tone-'+tone}>
    <div className="cardicon"><I size={20}/></div>
    <div><span>{t}</span><strong>{v}</strong></div>
  </div>;
}

function MetricRow({label,value,icon:Icon}){
  return <div className="metric-row">
    <div className="metric-icon"><Icon size={17}/></div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>;
}

function LoanRow({loan,data}){
  const user=(data.usuarios||[]).find(x=>Number(x.id)===Number(loan.id_usuario));
  let book=(data.livros||[]).find(x=>Number(x.id)===Number(loan.id_livro));
  if(!book&&loan.id_exemplar!=null){
    const copy=(data.exemplares||[]).find(x=>Number(x.id)===Number(loan.id_exemplar));
    if(copy) book=(data.livros||[]).find(x=>Number(x.id)===Number(copy.id_livro));
  }
  const status=loan.status||'Registrado';
  return <div className="activity-row">
    <div className="activity-icon"><BookCopy size={17}/></div>
    <div className="activity-main">
      <strong>{book?.titulo||'Livro #'+(loan.id_livro??loan.id_exemplar??'—')}</strong>
      <span>{user?.nome||'Usuário #'+(loan.id_usuario??'—')}</span>
    </div>
    <div className="activity-meta">
      <StatusBadge value={status}/>
      <small>{formatDate(loan.data_emprestimo)}</small>
    </div>
  </div>;
}

function StatusBadge({value}){
  return <span className={'status-badge '+statusClass(value)}>{String(value||'—')}</span>;
}

function EmptyState({text,loading=false,compact=false}){
  return <div className={'empty '+(compact?'compact':'')}>
    <div className="empty-icon">{loading?<RefreshCw size={22} className="spin"/>:<Search size={22}/>}</div>
    <strong>{text}</strong>
    {!loading&&!compact&&<span>Tente ajustar a busca ou adicione um novo registro quando disponível.</span>}
  </div>;
}

function Table({table,rows,data,editable,canReturn,onEdit,onDelete,onReturn,saving}){
  const keys=Object.keys(rows[0]||{}).filter(k=>k!=='senha');
  const hasActions=editable||(canReturn&&table==='emprestimos');
  return <div className="tablewrap"><table>
    <thead><tr>{keys.map(k=><th key={k}>{labels[k]||k.replaceAll('_',' ')}</th>)}{hasActions&&<th>Ações</th>}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={row.id??i}>
      {keys.map(key=><td key={key}>
        {key==='status'?<StatusBadge value={row[key]}/>:displayValue(key,row[key],data)}
      </td>)}
      {hasActions&&<td><div className="row-actions">
        {editable&&<>
          <button className="icon-btn" title="Editar" aria-label="Editar" onClick={()=>onEdit(row)}><Pencil size={15}/></button>
          <button className="icon-btn danger" title="Excluir" aria-label="Excluir" onClick={()=>onDelete(row)}><Trash2 size={15}/></button>
        </>}
        {canReturn&&table==='emprestimos'&&!isLoanReturned(row)&&
          <button className="icon-btn success" disabled={saving} title="Registrar devolução" aria-label="Registrar devolução" onClick={()=>onReturn(row)}>
            <CheckCircle2 size={16}/>
          </button>}
      </div></td>}
    </tr>)}</tbody>
  </table></div>;
}

function EditorModal({modal,form,setForm,categories,publishers,users,books,saving,error,onClose,onSave}){
  const book=modal.table==='livros';
  const loan=modal.table==='emprestimos';
  const update=(field,value)=>setForm(f=>({...f,[field]:value}));
  const selectedBook=loan?books.find(x=>String(x.id)===String(form.id_livro)):null;
  const title=loan?'Novo empréstimo':book?(modal.mode==='new'?'Novo livro':'Editar livro'):(modal.mode==='new'?'Novo usuário':'Editar usuário');
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal">
      <div className="modal-head">
        <div><span>{loan?'CIRCULAÇÃO':modal.mode==='new'?'CADASTRO':'EDIÇÃO'}</span><h2>{title}</h2></div>
        <button className="close-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button>
      </div>
      <form onSubmit={onSave}>
        {loan?<>
          <div className="field full">
            <label>Usuário</label>
            <select value={form.id_usuario||''} onChange={e=>update('id_usuario',e.target.value)}>
              <option value="">Selecione quem vai retirar</option>
              {users.map(user=><option key={user.id} value={user.id}>{user.nome||user.usuario}</option>)}
            </select>
          </div>
          <div className="field full">
            <label>Livro</label>
            <select value={form.id_livro||''} onChange={e=>update('id_livro',e.target.value)}>
              <option value="">Selecione um livro</option>
              {books.map(item=><option key={item.id} value={item.id} disabled={Number(item.quantidade||0)<=0}>
                {item.titulo} — {Number(item.quantidade||0)>0?item.quantidade+' disponível(is)':'sem estoque'}
              </option>)}
            </select>
          </div>
          <div className="loan-summary">
            <div><span>Prazo</span><strong>14 dias</strong></div>
            <div><span>Devolução prevista</span><strong>{formatDate(addDaysIso(14))}</strong></div>
            <div><span>Preço do aluguel</span><strong>{selectedBook?formatMoney(selectedBook.preco):'—'}</strong></div>
          </div>
        </>:book?<>
          <div className="field full"><label>Título</label><input value={form.titulo||''} onChange={e=>update('titulo',e.target.value)} placeholder="Ex.: Dom Casmurro"/></div>
          <div className="field full"><label>Autor</label><input value={form.autor||''} onChange={e=>update('autor',e.target.value)} placeholder="Nome do autor"/></div>
          <div className="form-grid">
            <div className="field"><label>Quantidade</label><input type="number" min="0" value={form.quantidade||''} onChange={e=>update('quantidade',e.target.value)}/></div>
            <div className="field"><label>Preço de aluguel</label><input type="number" min="0" step="0.01" value={form.preco||''} onChange={e=>update('preco',e.target.value)} placeholder="0,00"/></div>
            <div className="field"><label>Categoria</label><select value={form.id_categoria||''} onChange={e=>update('id_categoria',e.target.value)}><option value="">Sem categoria</option>{categories.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
            <div className="field"><label>Editora</label><select value={form.id_editora||''} onChange={e=>update('id_editora',e.target.value)}><option value="">Sem editora</option>{publishers.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
          </div>
        </>:<>
          <div className="field full"><label>Nome</label><input value={form.nome||''} onChange={e=>update('nome',e.target.value)} placeholder="Nome completo"/></div>
          <div className="field full"><label>E-mail</label><input type="email" value={form.email||''} onChange={e=>update('email',e.target.value)} placeholder="usuario@email.com"/></div>
          <div className="form-grid">
            <div className="field"><label>Usuário</label><input value={form.usuario||''} onChange={e=>update('usuario',e.target.value)} placeholder="login"/></div>
            <div className="field"><label>Senha</label><input type="password" value={form.senha||''} onChange={e=>update('senha',e.target.value)} placeholder={modal.mode==='edit'?'Deixe vazio para manter':'Digite uma senha'}/></div>
          </div>
        </>}
        {error&&<div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving?'Salvando...':'Salvar'}</button>
        </div>
      </form>
    </div>
  </div>;
}


function LoginScreen({onLogin}){
  const [login,setLogin]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  async function submit(e){
    e.preventDefault();
    setLoading(true);
    setError('');

    try{
      const response=await fetch('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({login,password})
      });
      const result=await response.json();

      if(!response.ok){
        setError(result?.error||'Não foi possível entrar.');
        setLoading(false);
        return;
      }

      onLogin(result.user);
    }catch{
      setError('Não foi possível conectar ao sistema.');
      setLoading(false);
    }
  }

  return <div className="login-page">
    <div className="login-shell">
      <section className="login-showcase">
        <div className="login-brand">
          <div className="login-logo"><BookOpen size={26}/><span>DS</span></div>
          <div><strong>Biblioteca DS</strong><span>2º DS • ETEC</span></div>
        </div>

        <div className="login-message">
          <span className="login-kicker"><Sparkles size={13}/> SISTEMA DE BIBLIOTECA</span>
          <h1>Seu acervo, organizado.</h1>
          <p>Consulte livros e acompanhe a circulação. Administradores têm acesso às ferramentas de gerenciamento.</p>
        </div>

        <div className="login-feature-grid">
          <div><BookOpen size={18}/><span>Acervo</span></div>
          <div><BookCopy size={18}/><span>Empréstimos</span></div>
          <div><Star size={18}/><span>Avaliações</span></div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-head">
          <span>ACESSO</span>
          <h2>Entrar na biblioteca</h2>
          <p>Modo demonstração: o domínio do e-mail define o tipo de acesso.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label>E-mail de acesso</label>
            <div className="login-input">
              <AtSign size={17}/>
              <input
                autoComplete="username"
                value={login}
                onChange={e=>setLogin(e.target.value)}
                placeholder="ex.: admin@gmail.com"
              />
            </div>
          </div>

          <div className="login-field">
            <label>Senha</label>
            <div className="login-input">
              <LockKeyhole size={17}/>
              <input
                type={showPassword?'text':'password'}
                autoComplete="current-password"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="Sua senha"
              />
              <button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>
                {showPassword?<EyeOff size={17}/>:<Eye size={17}/>}
              </button>
            </div>
          </div>

          {error&&<div className="login-error">{error}</div>}

          <button className="login-submit" disabled={loading}>
            {loading?<><RefreshCw size={17} className="spin"/> Entrando...</>:<>Entrar <ArrowUpRight size={17}/></>}
          </button>
        </form>

        <div className="login-role-note">
          <div className="role-icon admin"><ShieldCheck size={16}/></div>
          <div><strong>Administrador • @gmail.com</strong><span>Gerencia acervo, usuários e empréstimos. Qualquer senha preenchida.</span></div>
        </div>
        <div className="login-role-note">
          <div className="role-icon"><UserRound size={16}/></div>
          <div><strong>Usuário • @email.com</strong><span>Acompanha seus próprios registros. Qualquer senha preenchida.</span></div>
        </div>
      </section>
    </div>
  </div>;
}
