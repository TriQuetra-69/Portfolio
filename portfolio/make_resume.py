from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
RED=colors.HexColor('#b3262c'); INK=colors.HexColor('#1f2937'); MUTED=colors.HexColor('#555f6d'); GOLD=colors.HexColor('#c9962b')
doc=SimpleDocTemplate('/home/user/portfolio/assets/Sanskar_Pandey_Resume.pdf',pagesize=A4,leftMargin=16*mm,rightMargin=16*mm,topMargin=13*mm,bottomMargin=12*mm,
  title='Sanskar Pandey - Resume',author='Sanskar Pandey',subject='MCA (Cloud Computing) - Resume')
S=lambda **k: ParagraphStyle('x',**{'fontName':'Helvetica','fontSize':9.6,'leading':13.2,'textColor':INK,**k})
name=S(fontName='Helvetica-Bold',fontSize=24,leading=28,textColor=colors.HexColor('#0b1d33'))
role=S(fontName='Helvetica-Bold',fontSize=11,leading=15,textColor=RED)
contact=S(fontSize=9,textColor=MUTED)
h=S(fontName='Helvetica-Bold',fontSize=11,leading=14,textColor=colors.HexColor('#0b1d33'),spaceBefore=7,spaceAfter=2)
body=S(); bold=S(fontName='Helvetica-Bold'); right=S(fontName='Helvetica-Oblique',textColor=MUTED,alignment=2,fontSize=9)
bul=S(leftIndent=10,bulletIndent=0)
st=[]
st+= [Paragraph('Sanskar Pandey',name), Paragraph('MCA (Cloud Computing) Student &nbsp;|&nbsp; Aspiring Cloud Engineer',role),
      Paragraph('(+91) 8169146991 &nbsp;·&nbsp; <a href="mailto:Sanskarp681@gmail.com" color="#b3262c">Sanskarp681@gmail.com</a> &nbsp;·&nbsp; Mumbra, Thane, Maharashtra 400612',contact),
      Spacer(1,4), HRFlowable(width='100%',thickness=1.4,color=GOLD,spaceAfter=2)]
def sec(t): st.extend([Paragraph(t.upper(),h), HRFlowable(width='100%',thickness=0.5,color=colors.HexColor('#d5d9de'),spaceAfter=4)])
def row(l,r,style=bold):
    t=Table([[Paragraph(l,style),Paragraph(r,right)]],colWidths=[doc.width*0.64,doc.width*0.36],hAlign='LEFT')
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    st.append(t)
sec('Summary')
st.append(Paragraph('MCA student specialising in <b>Cloud Computing</b> at <b>Parul University</b>, with a B.Sc. in Computer Science from Mumbai University. '
 'Hands-on knowledge of <b>Linux</b> and <b>Python</b>, backed by a strong foundation in programming, web development and problem-solving. '
 'Passionate about cloud technologies and building efficient, reliable software. Seeking an internship or entry-level role in cloud, DevOps or software development '
 'to apply my technical knowledge and contribute to innovative projects in a growth-oriented organisation.',body))
sec('Education')
row('MCA — Master of Computer Applications (Cloud Computing)','2025 – 2027 (Pursuing)')
st.append(Paragraph('Parul University, Vadodara, Gujarat',S(textColor=MUTED))); st.append(Spacer(1,3))
row('Bachelor of Science in Computer Science','Aug 2022 – Apr 2025'); st.append(Paragraph('Mumbai University',S(textColor=MUTED))); st.append(Spacer(1,3))
row('Higher Secondary Certificate (HSC)','Mar 2021 – Mar 2022'); st.append(Paragraph('Mumbai University',S(textColor=MUTED))); st.append(Spacer(1,3))
row('Secondary School Certificate (SSC)','Jan 2019 – Mar 2020'); st.append(Paragraph('Mumbai University',S(textColor=MUTED)))
sec('Technical Skills')
skills=[('Cloud &amp; OS','Cloud Computing fundamentals (IaaS, PaaS, SaaS, virtualisation), Linux (command line, file system, permissions, shell basics)'),
 ('Languages','Python, Java, C++'),('Web','HTML, CSS, JavaScript, Bootstrap'),('Databases','MySQL, MongoDB (basics)'),
 ('Tools','Git, GitHub, VS Code'),('Core','Data Structures &amp; Algorithms')]
t=Table([[Paragraph(a,bold),Paragraph(b,body)] for a,b in skills],colWidths=[28*mm,doc.width-28*mm],hAlign='LEFT')
t.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1),('VALIGN',(0,0),(-1,-1),'TOP')])); st.append(t)
sec('Projects')
projs=[('Weather WebApp','HTML · CSS · JavaScript · REST API','Created a weather web app that fetches real-time weather data from a public API (OpenWeatherMap). Users can search any city and view current temperature, conditions, humidity and wind speed. Focused on responsive design and robust API handling.'),
 ('tmovies — Movie Web App','HTML · CSS · JavaScript · REST API','Designed and developed a movie web app to search and view movie information using a public API. Implemented title search, poster display, ratings and descriptions with a clean UI and dynamic content rendering.'),
 ('Chess Game','HTML · CSS · JavaScript','Developed a web-based chess game allowing two players to play in real time with a user-friendly interface. Implemented standard chess rules and piece movements, game logic, interactive UI and basic move validation.')]
for n,tech,d in projs:
    row(n,tech); st.append(Paragraph(d,body)); st.append(Spacer(1,4))
sec('Key Competencies')
comp='Excellent communication skills &nbsp;•&nbsp; Strong interpersonal skills &nbsp;•&nbsp; Proactive and self-motivated &nbsp;•&nbsp; Exceptional organisational skills'
st.append(Paragraph(comp,body))
doc.build(st)
print('ok')
