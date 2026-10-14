from app import db

db.init_db()
task = db.add_task('Test task', due_at='2026-10-07T09:00')
print(task)
db.set_done(task['id'], True)
print(db.list_tasks('done'))
db.delete_task(task['id'])
print(db.list_tasks('all'))