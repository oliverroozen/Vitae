@ECHO OFF
mode con: cols=180 lines=30
color 0C
"C:\Program Files\MySQL\mysql-5.7.18-winx64\bin\mysqladmin" -u root shutdown
PAUSE